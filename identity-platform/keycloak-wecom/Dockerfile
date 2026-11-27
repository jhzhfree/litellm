FROM maven:3.9.9-eclipse-temurin-21@sha256:3a4ab3276a087bf276f79cae96b1af04f53731bec53fb2e651aca79e4b10211e AS build
# 内网构建：Maven 经 settings.xml 代理下载依赖（JVM 属性方式对 resolver 不生效，见 maven-settings.xml）
COPY keycloak-wecom/maven-settings.xml /root/.m2/settings.xml
WORKDIR /build
COPY keycloak-wecom/pom.xml ./
COPY keycloak-wecom/src ./src
RUN mvn -B -q verify

FROM quay.io/keycloak/keycloak:26.4.7@sha256:9409c59bdfb65dbffa20b11e6f18b8abb9281d480c7ca402f51ed3d5977e6007
COPY --from=build --chown=keycloak:keycloak /build/target/keycloak-wecom-1.0.0.jar /opt/keycloak/providers/keycloak-wecom.jar
# AOIDC 主题（含简体中文消息包 messages_zh_Hans.properties）与 realm 配置烤入镜像，版本化随镜像分发
COPY keycloak-theme /opt/keycloak/themes
COPY realm.json /opt/keycloak/data/import/company-realm.json
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true
