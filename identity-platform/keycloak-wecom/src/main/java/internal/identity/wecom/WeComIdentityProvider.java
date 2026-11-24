package internal.identity.wecom;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriBuilder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.broker.provider.AbstractIdentityProvider;
import org.keycloak.broker.provider.AuthenticationRequest;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityBrokerException;
import org.keycloak.broker.social.SocialIdentityProvider;
import org.keycloak.common.util.SecretGenerator;
import org.keycloak.events.EventBuilder;
import org.keycloak.models.FederatedIdentityModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.services.ErrorPage;
import org.keycloak.services.messages.Messages;

public final class WeComIdentityProvider extends AbstractIdentityProvider<OAuth2IdentityProviderConfig>
        implements SocialIdentityProvider<OAuth2IdentityProviderConfig> {
    private final WeComClient client;

    WeComIdentityProvider(KeycloakSession session, OAuth2IdentityProviderConfig config, WeComClient client) {
        super(session, config);
        this.client = client;
    }

    @Override
    public Response performLogin(AuthenticationRequest request) {
        final var corpId = getConfig().getClientId();
        final var agentId = getConfig().getConfig().get("agentId");
        if (corpId == null || !corpId.matches("[A-Za-z0-9_-]{1,128}")
                || agentId == null || !agentId.matches("[0-9]{1,20}")) {
            throw new IdentityBrokerException("WeCom CorpID and AgentId must be configured");
        }
        final var state = SecretGenerator.getInstance().generateSecureID();
        session.singleUseObjects().put(stateKey(state), 300, Map.of("brokerState", request.getState().getEncoded()));
        return Response.seeOther(UriBuilder.fromUri("https://open.work.weixin.qq.com/wwopen/sso/qrConnect")
                .queryParam("appid", corpId).queryParam("agentid", agentId)
                .queryParam("redirect_uri", request.getRedirectUri()).queryParam("state", state).build()).build();
    }

    private String stateKey(String state) {
        return "wecom:" + session.getContext().getRealm().getId() + ":" + getConfig().getAlias() + ":" + state;
    }

    @Override
    public Object callback(RealmModel realm, AuthenticationCallback callback, EventBuilder event) {
        return new Callback(this, callback);
    }

    @Override
    public Response retrieveToken(KeycloakSession session, FederatedIdentityModel identity) {
        return Response.status(400).entity("WeCom token retrieval is not supported").build();
    }

    public static final class Callback {
        private final WeComIdentityProvider provider;
        private final AuthenticationCallback callback;

        Callback(WeComIdentityProvider provider, AuthenticationCallback callback) {
            this.provider = provider;
            this.callback = callback;
        }

        @GET
        public Response finish(@QueryParam("state") String state, @QueryParam("code") String code) {
            if (state == null || state.isBlank() || state.length() > 256) {
                return denied();
            }
            final var session = provider.session;
            final var config = provider.getConfig();
            final var saved = session.singleUseObjects().remove(provider.stateKey(state));
            if (saved == null || code == null || code.isBlank() || code.length() > 512) {
                return denied();
            }
            try {
                final var authSession = callback.getAndVerifyAuthenticationSession(saved.get("brokerState"));
                session.getContext().setAuthenticationSession(authSession);
                try (final var vault = session.vault().getStringSecret(config.getClientSecret())) {
                    final var secret = vault.get().orElse(config.getClientSecret());
                    if (secret == null || secret.isBlank() || secret.startsWith("${vault.")) {
                        return denied();
                    }
                    final var corpId = config.getClientId();
                    final var userId = provider.client.member(corpId, secret, code);
                    final var subject = WeComClient.subject(corpId, userId);
                    final var identity = new BrokeredIdentityContext(subject, config);
                    identity.setUsername(username(subject));
                    identity.setIdp(provider);
                    identity.setAuthenticationSession(authSession);
                    return callback.authenticated(identity);
                }
            } catch (Exception error) {
                return denied();
            }
        }

        private Response denied() {
            return ErrorPage.error(provider.session, null, Response.Status.BAD_REQUEST,
                    Messages.IDENTITY_PROVIDER_UNEXPECTED_ERROR);
        }
    }

    static String username(String subject) {
        try {
            return "wecom-" + HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(subject.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }
}
