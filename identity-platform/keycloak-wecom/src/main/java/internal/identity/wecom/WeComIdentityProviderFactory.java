package internal.identity.wecom;

import java.util.List;
import org.keycloak.broker.oidc.OAuth2IdentityProviderConfig;
import org.keycloak.broker.provider.AbstractIdentityProviderFactory;
import org.keycloak.broker.social.SocialIdentityProviderFactory;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderConfigurationBuilder;

public final class WeComIdentityProviderFactory extends AbstractIdentityProviderFactory<WeComIdentityProvider>
        implements SocialIdentityProviderFactory<WeComIdentityProvider> {
    private final WeComClient client = new WeComClient(new WeComClient.HttpsTransport());

    @Override
    public String getId() { return "wecom"; }

    @Override
    public String getName() { return "企业微信 / WeCom"; }

    @Override
    public OAuth2IdentityProviderConfig createConfig() { return new OAuth2IdentityProviderConfig(); }

    @Override
    public WeComIdentityProvider create(KeycloakSession session, IdentityProviderModel model) {
        return new WeComIdentityProvider(session, new OAuth2IdentityProviderConfig(model), client);
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return ProviderConfigurationBuilder.create().property()
                .name("agentId").label("Agent ID")
                .helpText("企业自建应用 AgentId. Client ID 填 CorpID, Client Secret 填该应用 Secret 或 Keycloak vault 引用.")
                .type(ProviderConfigProperty.STRING_TYPE).add().build();
    }
}
