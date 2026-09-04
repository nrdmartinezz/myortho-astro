/**
 * Progressive-enhancement handler for /api/submit.php forms.
 * RecaptchaV3 attaches the token in capture phase, then re-submits here.
 */

import { trackConversion } from './track';

function isSiteForm(form: EventTarget | null): form is HTMLFormElement {
  return (
    form instanceof HTMLFormElement &&
    (form.dataset.siteForm !== undefined || form.action.includes('/api/submit.php'))
  );
}

function getThankYouUrl(form: HTMLFormElement): string {
  const config = document.getElementById('form-handler-config');
  const fallback = config?.dataset.thankYou ?? '/thank-you/';
  return (
    form.dataset.thankYou ||
    form.querySelector<HTMLInputElement>('[name="_next"]')?.value ||
    fallback
  );
}

function showFormError(form: HTMLFormElement, text: string): void {
  const message = form.querySelector<HTMLElement>('.form-message');
  const messageText = message?.querySelector<HTMLElement>('.form-message-text');
  if (message && messageText) {
    message.dataset.state = 'error';
    messageText.textContent = text;
    message.hidden = false;
    message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  window.alert(text);
}

export function initSiteForms(): void {
  const config = document.getElementById('form-handler-config');
  const formEndpoint = config?.dataset.endpoint ?? '/api/submit.php';

  document.addEventListener(
    'submit',
    async (event) => {
      const form = event.target;
      if (!isSiteForm(form)) return;

      if (!form.checkValidity()) {
        event.preventDefault();
        showFormError(form, 'Please correct the highlighted fields.');
        form.querySelector<HTMLElement>(':invalid')?.focus();
        return;
      }

      event.preventDefault();

      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      submit?.setAttribute('disabled', '');

      try {
        const response = await fetch(form.action || formEndpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || String(response.status));
        }

        const trackSource = form.dataset.trackSource;
        if (trackSource) trackConversion('lead', { source: trackSource });

        window.location.href = getThankYouUrl(form);
      } catch (error) {
        submit?.removeAttribute('disabled');
        const message = error instanceof Error ? error.message : '';
        showFormError(
          form,
          message && message !== '500'
            ? message
            : 'Something went wrong sending that. Please call us instead.',
        );
      }
    },
    false,
  );
}
