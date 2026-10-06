package in.fonzkart.backend.auth.service;

/** Email subjects and bodies copied verbatim from actions/auth.ts. */
final class AuthEmails {

    static final String VERIFY_SUBJECT = "Verify your Fonzkart Account";
    static final String RESET_SUBJECT = "Your Password Reset OTP - Fonzkart";
    static final String WELCOME_SUBJECT = "Welcome to Fonzkart! 🚀";

    private AuthEmails() {
    }

    /** signup(): verification OTP */
    static String signupOtp(String otp) {
        return """
              <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Welcome to Fonzkart!</h2>
                <p>Please use the following 6-digit OTP to verify your email address and finish signing up:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                  %s
                </div>
                <p style="color: #888; font-size: 12px;">This code will expire in 15 minutes.</p>
              </div>
            """.formatted(otp);
    }

    /** signin(): new OTP for an UNVERIFIED account */
    static String resendOtp(String otp) {
        return "<p>Your new verification OTP is: <b>" + otp + "</b></p>";
    }

    /** requestPasswordReset() */
    static String passwordResetOtp(String otp) {
        return """
              <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Password Reset Verification</h2>
                <p>You requested to reset your password on Fonzkart. Please use the following 6-digit OTP to verify your identity:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                  %s
                </div>
                <p style="color: #888; font-size: 12px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
              </div>
            """.formatted(otp);
    }

    /** verifyEmailSignup(): welcome email */
    static String welcome(String name, String appUrl) {
        return """
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Welcome to Fonzkart, %s!</h2>
        <p>We are absolutely thrilled to welcome you to the Fonzkart family.</p>
        <p>At Fonzkart, we believe in giving you the fastest, most reliable, and highest-paying platform to sell your used gadgets right from the comfort of your home.</p>
        <p>Now that your account is officially verified, you are ready to sell your very first device in less than 60 seconds.</p>

        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
          <a href="%s/" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Get Exact Value</a>
        </div>

        <p style="color: #888; font-size: 13px;">If you have any questions, our support team is always available to help.</p>
      </div>
    """.formatted(name, appUrl);
    }
}
