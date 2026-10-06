# Fonzkart Spring Boot backend. Build context: this backend/ folder (in Coolify: Base Directory "/backend").
# Required environment (set in Coolify, never in this file): DB_URL (jdbc:postgresql://host:5432/db), DB_USERNAME,
# DB_PASSWORD, AUTH_SECRET (same value as the website's), SMTP_* for mail. See README.md.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
# Tests run separately (they need Docker for PostgreSQL); the image only packages the application.
RUN mvn -q -B -DskipTests package && cp target/fonzkart-backend-*.jar /app.jar

FROM eclipse-temurin:17-jre
RUN useradd --system --uid 10001 fonzkart
COPY --from=build /app.jar /app/app.jar
USER fonzkart
EXPOSE 8080
# Health check for Coolify: GET /actuator/health/liveness on port 8080.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
