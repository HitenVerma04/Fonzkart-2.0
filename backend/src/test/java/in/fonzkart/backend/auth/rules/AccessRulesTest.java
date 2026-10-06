package in.fonzkart.backend.auth.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import in.fonzkart.backend.auth.config.AuthProperties;
import in.fonzkart.backend.auth.session.SessionPayload;
import in.fonzkart.backend.auth.session.SessionUser;
import in.fonzkart.backend.shared.web.ActionException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** lib/auth-utils.ts isAdmin/isSuperAdmin and the lib/session.ts identity overrides, case by case. */
class AccessRulesTest {

    private final AccessRules rules = new AccessRules(new AuthProperties("s",
            List.of("admin@fonzkart.in", "admin@fonzkart.com", "noumaanraihaan@gmail.com"), Map.of(),
            List.of("mobilesouls.in@gmail.com"), "https://www.fonzkart.in"));

    @ParameterizedTest(name = "isAdmin({0}, {1}) = {2}")
    @CsvSource({
            "user@x.com, USER, false",
            "user@x.com, UNVERIFIED, false",
            "user@x.com, ADMIN, true",
            "user@x.com, SUPER_ADMIN, true",
            // Preserved rule: these roles count as "admin" in the original
            "user@x.com, ZONAL_HEAD, true",
            "user@x.com, RELATIONSHIP_MANAGER, true",
            "user@x.com, PARTNER, true",
            "user@x.com, FIELD_EXECUTIVE, true",
            "ADMIN@FONZKART.IN, USER, true",
            "mobilesouls.in@gmail.com, SUPER_ADMIN, false",
            "Mobilesouls.in@gmail.com, ADMIN, false",
    })
    void isAdminMatchesOriginal(String email, String role, boolean expected) {
        assertThat(rules.isAdmin(new SessionUser("1", email, "N", role))).isEqualTo(expected);
    }

    @ParameterizedTest(name = "isSuperAdmin({0}, {1}) = {2}")
    @CsvSource({
            "user@x.com, ADMIN, false",
            "user@x.com, SUPER_ADMIN, true",
            "noumaanraihaan@gmail.com, USER, true",
            "mobilesouls.in@gmail.com, SUPER_ADMIN, false",
    })
    void isSuperAdminMatchesOriginal(String email, String role, boolean expected) {
        assertThat(rules.isSuperAdmin(new SessionUser("1", email, "N", role))).isEqualTo(expected);
    }

    @Test
    void identityOverridesMatchLoginAndGetSession() {
        assertThat(rules.applyIdentityOverrides(new SessionUser("1", "Admin@Fonzkart.com", "A", "USER")).role())
                .isEqualTo(Roles.SUPER_ADMIN);
        assertThat(rules.applyIdentityOverrides(new SessionUser("1", "mobilesouls.in@gmail.com", "M", "SUPER_ADMIN")).role())
                .isEqualTo(Roles.USER);
        assertThat(rules.applyIdentityOverrides(new SessionUser("1", "p@x.com", "P", "PARTNER")).role())
                .isEqualTo(Roles.PARTNER);
    }

    @Test
    void requireStaffPanelLetsEveryStaffRoleInButNotCustomers() {
        assertThatThrownBy(() -> rules.requireStaffPanel(Optional.empty()))
                .isInstanceOf(ActionException.class).hasMessage("Unauthorized");
        assertThatThrownBy(() -> rules.requireStaffPanel(Optional.of(new SessionPayload(null, null, null, null))))
                .isInstanceOf(ActionException.class).hasMessage("Unauthorized");
        assertThatThrownBy(() -> rules.requireStaffPanel(session("u@x.com", "USER")))
                .isInstanceOf(ActionException.class).hasMessage("Forbidden: Admin access required");
        assertThat(rules.requireStaffPanel(session("p@x.com", "PARTNER")).role()).isEqualTo("PARTNER");
    }

    @Test
    void protectedSuperAdminCheckTrimsAndLowercases() {
        assertThat(rules.isProtectedSuperAdmin("  ADMIN@fonzkart.in ")).isTrue();
        assertThat(rules.isProtectedSuperAdmin("someone@x.com")).isFalse();
    }

    private static Optional<SessionPayload> session(String email, String role) {
        return Optional.of(new SessionPayload(new SessionUser("1", email, "N", role), null, null, null));
    }
}
