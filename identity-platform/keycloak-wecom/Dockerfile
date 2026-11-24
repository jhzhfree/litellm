FROM maven:3.9.9-eclipse-temurin-21@sha256:3a4ab3276a087bf276f79cae96b1af04f53731bec53fb2e651aca79e4b10211e AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B -q verify

FROM quay.io/keycloak/keycloak:26.4.7@sha256:9409c59bdfb65dbffa20b11e6f18b8abb9281d480c7ca402f51ed3d5977e6007
COPY --from=build --chown=keycloak:keycloak /build/target/keycloak-wecom-1.0.0.jar /opt/keycloak/providers/keycloak-wecom.jar
RUN /opt/keycloak/bin/kc.sh build --db=postgres --health-enabled=true
