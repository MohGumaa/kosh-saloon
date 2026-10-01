import { describe, expect, it } from "vitest";
import { loginNotificationEmail, passwordResetEmail } from "@/lib/auth/emails";

const login = {
  name: `<b>Sara</b> & "Co"`,
  language: "EN" as const,
  at: new Date("2026-10-01T10:30:00Z"),
  ipAddress: "203.0.113.5",
  userAgent: `Mozilla/5.0 <script>alert('x')</script>`,
  forgotPasswordUrl: "http://app.test/forgot-password",
};

describe("loginNotificationEmail", () => {
  it("escapes the name and user agent in HTML and keeps them raw in text", () => {
    const { html, text } = loginNotificationEmail(login);

    expect(html).toContain("&lt;b&gt;Sara&lt;/b&gt; &amp; &quot;Co&quot;");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<script>");
    expect(text).toContain(login.name);
    expect(text).toContain(login.userAgent);
  });

  it("reports the time in UTC with the IP and the reset link", () => {
    const { subject, html, text } = loginNotificationEmail(login);

    expect(subject).toBe("New sign-in to Kosh CRM");
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(text).toContain("10:30");
    expect(text).toContain("203.0.113.5");
    expect(html).toContain('<a href="http://app.test/forgot-password">');
  });

  it("writes right-to-left Arabic for an Arabic user", () => {
    const { subject, html } = loginNotificationEmail({ ...login, language: "AR" });

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(subject).not.toBe("New sign-in to Kosh CRM");
    expect(subject).toMatch(/[؀-ۿ]/);
  });
});

describe("passwordResetEmail", () => {
  const resetUrl = "http://app.test/reset-password?token=abc&x=1";

  it("escapes the name and the link, and keeps the raw link in text", () => {
    const { subject, html, text } = passwordResetEmail({ name: "<i>Sara</i>", language: "EN", resetUrl });

    expect(subject).toBe("Reset your Kosh CRM password");
    expect(html).toContain("&lt;i&gt;Sara&lt;/i&gt;");
    expect(html).toContain('<a href="http://app.test/reset-password?token=abc&amp;x=1">');
    expect(text).toContain(resetUrl);
  });

  it("writes right-to-left Arabic for an Arabic user", () => {
    expect(passwordResetEmail({ name: "سارة", language: "AR", resetUrl }).html).toContain('<html lang="ar" dir="rtl">');
  });
});
