package internal.identity.wecom;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.provider.IdentityBrokerException;

class WeComClientTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void exchangesCodeForMemberWithoutLeakingSecretToIdentityRequest() {
        final var calls = new AtomicInteger();
        final var client = new WeComClient(uri -> {
            assertEquals("https", uri.getScheme());
            assertEquals("qyapi.weixin.qq.com", uri.getHost());
            if (calls.getAndIncrement() == 0) {
                assertEquals("/cgi-bin/gettoken", uri.getPath());
                assertTrue(uri.getRawQuery().contains("corpsecret=a%26b%3Dc"));
                return mapper.readTree("{\"errcode\":0,\"access_token\":\"server-token\"}");
            }
            assertFalse(uri.getRawQuery().contains("corpsecret"));
            if (uri.getPath().equals("/cgi-bin/auth/getuserinfo")) {
                assertTrue(uri.getRawQuery().contains("code=one%26code"));
                return mapper.readTree("{\"errcode\":0,\"userid\":\"Employee-A\"}");
            }
            assertEquals("/cgi-bin/user/get", uri.getPath());
            return mapper.readTree("{\"errcode\":0,\"userid\":\"Employee-A\",\"status\":1}");
        });
        assertEquals("Employee-A", client.member("corp-a", "a&b=c", "one&code"));
        assertEquals(3, calls.get());
    }

    @Test
    void refusesVisitorsAndMalformedOrFailedIdentityResponses() {
        for (final var response : new String[] {
                "{\"errcode\":0,\"openid\":\"visitor\"}",
                "{\"errcode\":40029,\"userid\":\"injected\"}",
                "{\"userid\":\"injected\"}", "{\"errcode\":0,\"userid\":123}",
                "{\"errcode\":0,\"userid\":\" \"}"}) {
            final var client = new WeComClient(uri -> mapper.readTree(
                    uri.getPath().endsWith("gettoken")
                            ? "{\"errcode\":0,\"access_token\":\"token\"}" : response));
            assertThrows(IdentityBrokerException.class, () -> client.member("corp", "secret", "code"));
        }
    }

    @Test
    void tokenFailureStopsBeforeIdentityLookup() {
        final var calls = new AtomicInteger();
        final var client = new WeComClient(uri -> {
            calls.incrementAndGet();
            return mapper.readTree("{\"errcode\":40013,\"errmsg\":\"sensitive upstream details\"}");
        });
        final var error = assertThrows(IdentityBrokerException.class, () -> client.member("corp", "secret", "code"));
        assertEquals(1, calls.get());
        assertFalse(error.getMessage().contains("sensitive"));
    }

    @Test
    void rejectsDisabledOrInvisibleOrMismatchedMembers() {
        for (final var response : new String[] {
                "{\"errcode\":0,\"userid\":\"user\",\"status\":2}",
                "{\"errcode\":0,\"userid\":\"other\",\"status\":1}",
                "{\"errcode\":60011}", "{\"errcode\":0,\"userid\":\"user\"}"}) {
            final var client = new WeComClient(uri -> mapper.readTree(switch (uri.getPath()) {
                case "/cgi-bin/gettoken" -> "{\"errcode\":0,\"access_token\":\"token\"}";
                case "/cgi-bin/auth/getuserinfo" -> "{\"errcode\":0,\"userid\":\"user\"}";
                default -> response;
            }));
            assertThrows(IdentityBrokerException.class, () -> client.member("corp", "secret", "code"));
        }
    }

    @Test
    void networkFailureDoesNotExposeCredentialUrl() {
        final var client = new WeComClient(uri -> { throw new IOException(uri.toString()); });
        final var error = assertThrows(IdentityBrokerException.class, () -> client.member("corp", "secret", "code"));
        assertNull(error.getCause());
        assertFalse(error.toString().contains("secret"));
    }

    @Test
    void identitySeparatesCorporationsAndPreservesCase() {
        assertNotEquals(WeComClient.subject("a", "b.c"), WeComClient.subject("a.b", "c"));
        assertNotEquals(WeComClient.subject("corp-a", "user"), WeComClient.subject("corp-b", "user"));
        assertNotEquals(WeComClient.subject("corp", "User"), WeComClient.subject("corp", "user"));
        assertEquals(WeComIdentityProvider.username(WeComClient.subject("corp", "user")),
                WeComIdentityProvider.username(WeComClient.subject("corp", "user")));
    }
}
