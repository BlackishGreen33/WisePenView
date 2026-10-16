import { Form } from '@heroui/react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { AppButton } from '@/components/base/Button';
import { FormField, PasswordInput } from '@/components/base/Input';
import AppDisplayDialog from '@/components/business/AppDisplayDialog';
import { useAuthService } from '@/domains';
import type { ChangePasswordRequest } from '@/domains/Auth';
import { useApi } from '@/hooks/useApi';
import { authSessionCoordinator } from '@/utils/auth/authSessionCoordinator';
import { APP_ROUTE_PATH } from '@/utils/navigation/appRoute';
import {
  type FieldErrors,
  hasFieldErrors,
  runFieldValidation,
} from '@/utils/validation/formValidation';

import auth from '../_common/style.module.less';

type ChangePasswordFormValues = ChangePasswordRequest & {
  confirmPassword: string;
};
type ChangePasswordField = keyof ChangePasswordFormValues;

const DEFAULT_CHANGE_PASSWORD_VALUES: ChangePasswordFormValues = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function ChangePassword() {
  const authService = useAuthService();
  const { t } = useTranslation('auth');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<ChangePasswordFormValues>(
    DEFAULT_CHANGE_PASSWORD_VALUES
  );
  const [formErrors, setFormErrors] = useState<FieldErrors<ChangePasswordField>>({});
  const navigate = useNavigate();

  const { loading, run: submitChangePassword } = useApi(
    (values: ChangePasswordRequest) => authService.changePassword(values),
    {
      manual: true,
      onSuccess: () => setSuccessModalOpen(true),
    }
  );

  const updateFormValue = (field: ChangePasswordField, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: FieldErrors<ChangePasswordField> = {
      oldPassword: runFieldValidation([
        {
          test: () => formValues.oldPassword.length > 0,
          message: t('changePassword.oldPasswordRequired'),
        },
      ]),
      newPassword: runFieldValidation([
        {
          test: () => formValues.newPassword.length > 0,
          message: t('changePassword.passwordRequired'),
        },
        {
          test: () => formValues.newPassword.length >= 9,
          message: t('newPassword.passwordMinLength'),
        },
        {
          test: () => /[a-zA-Z]/.test(formValues.newPassword),
          message: t('newPassword.passwordContainsLetter'),
        },
        {
          test: () => /[0-9]/.test(formValues.newPassword),
          message: t('newPassword.passwordContainsNumber'),
        },
      ]),
      confirmPassword: runFieldValidation([
        {
          test: () => formValues.confirmPassword.length > 0,
          message: t('changePassword.confirmPasswordRequired'),
        },
        {
          test: () => formValues.confirmPassword === formValues.newPassword,
          message: t('newPassword.confirmPasswordMismatch'),
        },
      ]),
    };
    setFormErrors(nextErrors);
    return !hasFieldErrors(nextErrors);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    submitChangePassword({
      oldPassword: formValues.oldPassword,
      newPassword: formValues.newPassword,
    });
  };

  return (
    <div className={auth.authContainer}>
      <h1 className={auth.title}>{t('changePassword.title')}</h1>
      <Form onSubmit={handleSubmit} className={auth.form}>
        <FormField
          aria-label={t('changePassword.oldPasswordLabel')}
          label={t('changePassword.oldPasswordLabel')}
          name="oldPassword"
          value={formValues.oldPassword}
          onChange={(value) => updateFormValue('oldPassword', value)}
          errorMessage={formErrors.oldPassword}
          isRequired
        >
          <PasswordInput
            placeholder={t('changePassword.oldPasswordPlaceholder')}
            autoComplete="current-password"
            showPasswordLabel={t('common.showPassword')}
            hidePasswordLabel={t('common.hidePassword')}
          />
        </FormField>

        <FormField
          aria-label={t('newPassword.passwordLabel')}
          label={t('newPassword.passwordLabel')}
          name="newPassword"
          value={formValues.newPassword}
          onChange={(value) => updateFormValue('newPassword', value)}
          description={t('common.passwordRules')}
          errorMessage={formErrors.newPassword}
          isRequired
        >
          <PasswordInput
            placeholder={t('newPassword.passwordPlaceholder')}
            autoComplete="new-password"
            showPasswordLabel={t('common.showPassword')}
            hidePasswordLabel={t('common.hidePassword')}
          />
        </FormField>

        <FormField
          aria-label={t('newPassword.confirmPasswordLabel')}
          label={t('newPassword.confirmPasswordLabel')}
          name="confirmPassword"
          value={formValues.confirmPassword}
          onChange={(value) => updateFormValue('confirmPassword', value)}
          errorMessage={formErrors.confirmPassword}
          isRequired
        >
          <PasswordInput
            placeholder={t('newPassword.confirmPasswordPlaceholder')}
            autoComplete="new-password"
            showPasswordLabel={t('common.showPassword')}
            hidePasswordLabel={t('common.hidePassword')}
          />
        </FormField>

        <div className={auth.formActions}>
          <AppButton
            variant="primary"
            size="lg"
            type="submit"
            className={auth.submitButton}
            isDisabled={loading}
          >
            {t('changePassword.submit')}
          </AppButton>
          <div className={auth.centerLinks}>
            <Link to={APP_ROUTE_PATH.AUTH_LOGIN}>{t('newPassword.backToLogin')}</Link>
          </div>
        </div>
      </Form>
      <AppDisplayDialog
        isOpen={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        isDismissable={false}
        showCloseTrigger={false}
        title={t('changePassword.successTitle')}
        primaryAction={{
          label: t('changePassword.goToLogin'),
          onPress: () => {
            setSuccessModalOpen(false);
            navigate(APP_ROUTE_PATH.AUTH_LOGIN, { replace: true });
            authSessionCoordinator.publish('logout');
          },
        }}
      >
        <p>{t('changePassword.successDescription')}</p>
      </AppDisplayDialog>
    </div>
  );
}

export default ChangePassword;
