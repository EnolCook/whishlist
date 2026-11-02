import assert from "node:assert/strict";
import { test } from "node:test";
import { emailConfirmationPending } from "../../src/server/commands/context";
import {
  emailVerificationRequired,
  mailConfigured,
  mailDryRun,
  mailSmtpUrl,
  sendEmailChangeMail,
  sendEmailVerificationMail,
} from "../../src/server/mail";
import { apiDoc, mailLog, user, withStore } from "./helpers/api-fixtures";
import { withEnv } from "./helpers/env";

test("validation des adresses : absente sans envoi d'e-mail, active avec Resend ou l'envoi simulé", async () => {
  await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: undefined, NODE_ENV: "test" }, () => {
    assert.equal(emailVerificationRequired(), false);
  });
  await withEnv({ RESEND_API_KEY: "re_test", MAIL_FROM: "x@example.test", MAIL_DRY_RUN: undefined, NODE_ENV: "test" }, () => {
    assert.equal(emailVerificationRequired(), true);
  });
  await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: "1", NODE_ENV: "test" }, () => {
    assert.equal(mailDryRun(), true);
    assert.equal(emailVerificationRequired(), true);
  });
});

test("MAIL_DRY_RUN est ignorée en production", async () => {
  await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: "1", NODE_ENV: "production" }, () => {
    assert.equal(mailDryRun(), false);
    assert.equal(emailVerificationRequired(), false);
  });
});

test("emailConfirmationPending : un compte qui doit changer son mot de passe le fait d'abord", async () => {
  const sam = { ...user("sam", "sam@example.test", "Sam"), emailVerifiedAt: null };
  await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: "1", NODE_ENV: "test" }, () => {
    assert.equal(emailConfirmationPending(sam), true);
    assert.equal(emailConfirmationPending({ ...sam, mustChangePassword: true }), false);
  });
  await withEnv({ RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: undefined, NODE_ENV: "test" }, () => {
    assert.equal(emailConfirmationPending(sam), false);
  });
});

test("MAIL_SMTP_URL : envoi réel vers un serveur SMTP local, jamais en production", async () => {
  const base = { RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: undefined };
  await withEnv({ ...base, MAIL_SMTP_URL: "smtp://localhost:1025", NODE_ENV: "test" }, () => {
    assert.equal(mailSmtpUrl(), "smtp://localhost:1025");
    assert.equal(mailConfigured(), true);
    assert.equal(emailVerificationRequired(), true);
  });
  await withEnv({ ...base, MAIL_SMTP_URL: "smtp://localhost:1025", NODE_ENV: "production" }, () => {
    assert.equal(mailSmtpUrl(), null);
    assert.equal(mailConfigured(), false);
  });
  await withEnv({ ...base, MAIL_SMTP_URL: "https://localhost:1080", NODE_ENV: "test" }, () => {
    assert.equal(mailSmtpUrl(), null);
  });
});

test("mail.log en production : les liens de confirmation et de changement d'adresse sont masqués (FR-017)", async () => {
  const noMail = { RESEND_API_KEY: undefined, MAIL_FROM: undefined, MAIL_DRY_RUN: undefined, MAIL_SMTP_URL: undefined };
  await withStore(apiDoc(), () =>
    withEnv({ ...noMail, NODE_ENV: "production" }, async () => {
      const verify = "https://ohyoushouldnt.example.test/confirmer-email/jeton-verify";
      const change = "https://ohyoushouldnt.example.test/confirmer-email/jeton-change";
      await sendEmailVerificationMail({ to: "sam@example.test", confirmUrl: verify, locale: "fr" });
      await sendEmailChangeMail({ to: "sam.b@example.test", confirmUrl: change, locale: "fr" });
      const log = await mailLog();
      assert.match(log, /email-verification .*-> sam@example\.test/);
      assert.match(log, /email-change .*-> sam\.b@example\.test/);
      assert.match(log, /\[redacted-url\]/);
      assert.doesNotMatch(log, /jeton-/);
    }),
  );
});
