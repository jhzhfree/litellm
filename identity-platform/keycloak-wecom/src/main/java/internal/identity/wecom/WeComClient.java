package internal.identity.wecom;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import org.keycloak.broker.provider.IdentityBrokerException;

final class WeComClient {
    interface Transport {
        JsonNode get(URI uri) throws IOException, InterruptedException;
    }

    static final class HttpsTransport implements Transport {
        private final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
        private final ObjectMapper mapper = new ObjectMapper();

        @Override
        public JsonNode get(URI uri) throws IOException, InterruptedException {
            final var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).GET().build();
            final var response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200 || response.body().length() > 65536) {
                throw new IOException("WeCom HTTP response rejected");
            }
            return mapper.readTree(response.body());
        }
    }

    private final Transport transport;

    WeComClient(Transport transport) {
        this.transport = transport;
    }

    String member(String corpId, String secret, String code) {
        try {
            final var token = checked(transport.get(URI.create(
                    "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=" + encode(corpId)
                            + "&corpsecret=" + encode(secret))));
            final var accessToken = required(token, "access_token");
            final var user = checked(transport.get(URI.create(
                    "https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=" + encode(accessToken)
                            + "&code=" + encode(code))));
            final var userId = required(user, "userid");
            final var member = checked(transport.get(URI.create(
                    "https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=" + encode(accessToken)
                            + "&userid=" + encode(userId))));
            if (!userId.equals(required(member, "userid")) || !member.path("status").isIntegralNumber()
                    || member.path("status").asLong(-1) != 1) {
                throw new IdentityBrokerException("WeCom member is not active");
            }
            return userId;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IdentityBrokerException("WeCom login interrupted");
        } catch (IOException | IllegalArgumentException error) {
            throw new IdentityBrokerException("WeCom login failed");
        }
    }

    static JsonNode checked(JsonNode value) {
        if (value == null || !value.isObject() || !value.path("errcode").isIntegralNumber()
                || !value.path("errcode").canConvertToInt() || value.path("errcode").asInt(-1) != 0) {
            throw new IdentityBrokerException("WeCom API rejected login");
        }
        return value;
    }

    private static String required(JsonNode value, String key) {
        final var field = value.path(key);
        if (!field.isTextual() || field.asText().isBlank() || field.asText().length() > 2048) {
            throw new IdentityBrokerException("WeCom employee identity unavailable");
        }
        return field.asText();
    }

    static String subject(String corpId, String userId) {
        final var encoder = Base64.getUrlEncoder().withoutPadding();
        return encoder.encodeToString(corpId.getBytes(StandardCharsets.UTF_8)) + "."
                + encoder.encodeToString(userId.getBytes(StandardCharsets.UTF_8));
    }

    static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
