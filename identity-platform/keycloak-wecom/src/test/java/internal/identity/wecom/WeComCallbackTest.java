package internal.identity.wecom;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.broker.provider.AuthenticationRequest;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityProvider.AuthenticationCallback;
import org.keycloak.broker.provider.util.IdentityBrokerState;
import org.keycloak.models.KeycloakContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.SingleUseObjectProvider;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.keycloak.vault.VaultStringSecret;
import org.keycloak.vault.VaultTranscriber;
import org.mockito.ArgumentCaptor;

class WeComCallbackTest {
    private final KeycloakSession session = mock(KeycloakSession.class);
    private final KeycloakContext context = mock(KeycloakContext.class);
    private final RealmModel realm = mock(RealmModel.class);
    private final AuthenticationCallback callback = mock(AuthenticationCallback.class);
    private final AuthenticationSessionModel authSession = mock(AuthenticationSessionModel.class);
    private final Map<String, Map<String, String>> states = new ConcurrentHashMap<>();
    private final AtomicInteger requests = new AtomicInteger();
    private final OAuth2IdentityProviderConfig config = new OAuth2IdentityProviderConfig();
    private final WeComIdentityProvider provider;

    WeComCallbackTest() {
        config.setAlias("wecom");
        config.setClientId("corp-a");
        config.setClientSecret("test-secret");
        config.getConfig().put("agentId", "1000001");
        when(session.getContext()).thenReturn(context);
        when(context.getRealm()).thenReturn(realm);
        when(realm.getId()).thenReturn("realm-a");
        final var store = mock(SingleUseObjectProvider.class);
        when(session.singleUseObjects()).thenReturn(store);
        doAnswer(call -> {
            states.put(call.getArgument(0), call.getArgument(2));
            return null;
        }).when(store).put(anyString(), eq(300L), anyMap());
        when(store.remove(anyString())).thenAnswer(call -> states.remove(call.getArgument(0)));
        when(callback.getAndVerifyAuthenticationSession("broker-state")).thenReturn(authSession);
        final var forms = mock(LoginFormsProvider.class, RETURNS_SELF);
        when(session.getProvider(LoginFormsProvider.class)).thenReturn(forms);
        when(forms.createErrorPage(Response.Status.BAD_REQUEST)).thenReturn(Response.status(400).build());
        when(callback.authenticated(any())).thenReturn(Response.ok().build());
        final var vault = mock(VaultTranscriber.class);
        final var secret = mock(VaultStringSecret.class);
        when(session.vault()).thenReturn(vault);
        when(vault.getStringSecret("test-secret")).thenReturn(secret);
        when(secret.get()).thenReturn(Optional.of("test-secret"));
        final var mapper = new ObjectMapper();
        provider = new WeComIdentityProvider(session, config, new WeComClient(uri -> {
            requests.incrementAndGet();
            return mapper.readTree(uri.getPath().endsWith("gettoken")
                    ? "{\"errcode\":0,\"access_token\":\"token\"}"
                    : "{\"errcode\":0,\"userid\":\"employee\",\"status\":1}");
        }));
    }

    private String begin() {
        final var state = mock(IdentityBrokerState.class);
        when(state.getEncoded()).thenReturn("broker-state");
        final var request = new AuthenticationRequest(session, realm, authSession, null, null, state,
                "https://identity.example/realms/company/broker/wecom/endpoint");
        final var response = provider.performLogin(request);
        assertEquals("open.work.weixin.qq.com", response.getLocation().getHost());
        assertTrue(response.getLocation().getRawQuery().contains("agentid=1000001"));
        assertFalse(response.getLocation().toString().contains("test-secret"));
        return states.keySet().iterator().next().substring("wecom:realm-a:wecom:".length());
    }

    private Response finish(String state, String code) {
        return ((WeComIdentityProvider.Callback) provider.callback(realm, callback, null)).finish(state, code);
    }

    @Test
    void authenticatesStableMemberAndRejectsReplay() {
        final var state = begin();
        assertEquals(200, finish(state, "code").getStatus());
        final var captured = ArgumentCaptor.forClass(BrokeredIdentityContext.class);
        verify(callback).authenticated(captured.capture());
        assertEquals(WeComClient.subject("corp-a", "employee"), captured.getValue().getId());
        assertNull(captured.getValue().getEmail());
        assertNull(captured.getValue().getToken());
        assertSame(authSession, captured.getValue().getAuthenticationSession());
        assertEquals(400, finish(state, "code").getStatus());
        assertEquals(3, requests.get());
    }

    @Test
    void rejectsMissingUnknownAndExpiredStateWithoutNetwork() {
        assertEquals(400, finish(null, "code").getStatus());
        assertEquals(400, finish("unknown", "code").getStatus());
        final var expired = begin();
        states.clear();
        assertEquals(400, finish(expired, "code").getStatus());
        assertEquals(0, requests.get());
        verify(callback, never()).authenticated(any());
    }

    @Test
    void rejectsWrongRealmAndProvider() {
        final var state = begin();
        when(realm.getId()).thenReturn("other-realm");
        assertEquals(400, finish(state, "code").getStatus());
        when(realm.getId()).thenReturn("realm-a");
        config.setAlias("another-provider");
        assertEquals(400, finish(state, "code").getStatus());
        assertEquals(0, requests.get());
    }

    @Test
    void rejectsInvalidBrowserSessionBeforeCodeExchange() {
        final var state = begin();
        when(callback.getAndVerifyAuthenticationSession("broker-state")).thenThrow(new IllegalArgumentException());
        assertEquals(400, finish(state, "code").getStatus());
        assertEquals(0, requests.get());
    }

    @Test
    void cancelledLoginConsumesStateWithoutNetwork() {
        final var state = begin();
        assertEquals(400, finish(state, null).getStatus());
        assertEquals(400, finish(state, "code").getStatus());
        assertEquals(0, requests.get());
    }
}
