package in.fonzkart.backend.auth.config;

import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Auth settings mirroring constants hardcoded in the Next.js app (see application.yml for the sources).
 *
 * @param secret                  AUTH_SECRET shared with Next.js (session JWT signing key)
 * @param superAdminEmails        lib/auth-utils.ts → SUPER_ADMIN_EMAILS (also ADMIN_EMAILS)
 * @param superAdminDisplayNames  display names for configured super admins missing from the database
 * @param forcedUserEmails        emails forced to role USER and never treated as admin
 * @param appUrl                  NEXT_PUBLIC_APP_URL (welcome email link)
 */
@ConfigurationProperties(prefix = "fonzkart.auth")
public record AuthProperties(String secret, List<String> superAdminEmails, Map<String, String> superAdminDisplayNames,
                             List<String> forcedUserEmails, String appUrl) {

    public AuthProperties {
        superAdminEmails = superAdminEmails == null ? List.of() : List.copyOf(superAdminEmails);
        superAdminDisplayNames = superAdminDisplayNames == null ? Map.of() : Map.copyOf(superAdminDisplayNames);
        forcedUserEmails = forcedUserEmails == null ? List.of() : List.copyOf(forcedUserEmails);
    }
}
