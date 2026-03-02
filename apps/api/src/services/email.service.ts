import { Resend } from 'resend';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

const SUBJECTS: Record<string, string> = {
  de: 'Passwort zurücksetzen',
  fr: 'Réinitialiser votre mot de passe',
  it: 'Reimposta la tua password',
  nl: 'Wachtwoord opnieuw instellen',
  en: 'Reset your password',
};

const BODY_INTRO: Record<string, (name: string) => string> = {
  de: (name) => `Hallo ${name},<br><br>du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.`,
  fr: (name) => `Bonjour ${name},<br><br>Vous avez demandé la réinitialisation de votre mot de passe.`,
  it: (name) => `Ciao ${name},<br><br>Hai richiesto di reimpostare la tua password.`,
  nl: (name) => `Hallo ${name},<br><br>Je hebt een verzoek ingediend om je wachtwoord opnieuw in te stellen.`,
  en: (name) => `Hi ${name},<br><br>You requested a password reset.`,
};

const BUTTON_TEXT: Record<string, string> = {
  de: 'Passwort zurücksetzen',
  fr: 'Réinitialiser le mot de passe',
  it: 'Reimposta la password',
  nl: 'Wachtwoord opnieuw instellen',
  en: 'Reset password',
};

const EXPIRY_NOTE: Record<string, string> = {
  de: 'Dieser Link ist 1 Stunde gültig. Falls du kein Reset angefordert hast, kannst du diese E-Mail ignorieren.',
  fr: "Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.",
  it: 'Questo link scade tra 1 ora. Se non hai richiesto il reset, ignora questa email.',
  nl: 'Deze link is 1 uur geldig. Als je geen reset hebt aangevraagd, kun je deze e-mail negeren.',
  en: "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.",
};

export async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  resetLink: string,
  language: string,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    throw new AppError(503, 'Email service not configured. Set RESEND_API_KEY and FROM_EMAIL environment variables.');
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const lang = SUBJECTS[language] ? language : 'en';
  const subject = SUBJECTS[lang];
  const intro = BODY_INTRO[lang](displayName);
  const buttonText = BUTTON_TEXT[lang];
  const expiryNote = EXPIRY_NOTE[lang];

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p>${intro}</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}"
           style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px;
                  text-decoration: none; font-weight: 600; display: inline-block;">
          ${buttonText}
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        ${expiryNote}
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
        ${resetLink}
      </p>
    </div>
  `;

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html,
  });
}
