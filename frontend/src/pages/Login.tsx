import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Auth.module.css";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("유효한 이메일을 입력해주세요");
      return false;
    }
    if (!formData.password) {
      setError("비밀번호를 입력해주세요");
      return false;
    }
    return true;
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const result = await login(formData.email, formData.password);

    if (result.success) {
      setSuccess(true);
      setFormData({ email: "", password: "" });
      setTimeout(() => {
        navigate("/home");
      }, 1500);
    } else {
      setError(result.error || authError || "로그인 실패");
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.authLayout}>
      <div className={styles.scanlines} />
      <div className={styles.gridBg} />

      <div className={styles.authContainer}>
        <div className={`${styles.cornerAccent} ${styles.topLeft}`} />
        <div className={`${styles.cornerAccent} ${styles.topRight}`} />
        <div className={`${styles.cornerAccent} ${styles.bottomLeft}`} />
        <div className={`${styles.cornerAccent} ${styles.bottomRight}`} />

        {/* Header */}
        <div className={styles.authHeader}>
          <div className={styles.authLogo}>◇ NEON VAULT ◇</div>
          <h1 className={styles.authTitle}>
            SYSTEM <span>ACCESS</span>
          </h1>
          <p className={styles.authSubtitle}>// authenticate user //</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className={styles.successBox}>
            ✓ AUTHENTICATION SUCCESSFUL · GRANTING ACCESS...
          </div>
        )}

        {/* Error Message */}
        {(error || authError) && (
          <div className={styles.errorBox}>✗ {error || authError}</div>
        )}

        {/* Form */}
        <form className={styles.authForm} onSubmit={handleSubmit}>
          {/* Email Field */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>EMAIL ADDRESS</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="user@example.com"
              className={styles.formInput}
              disabled={isLoading || success}
            />
          </div>

          {/* Password Field */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>PASSWORD</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="enter your password"
              className={styles.formInput}
              disabled={isLoading || success}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading || success}
          >
            {isLoading ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <div className={styles.loadingSpinner} /> AUTHENTICATING
              </span>
            ) : (
              "▶ SIGN IN"
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ margin: "24px 0" }} className={styles.divider} />

        {/* Footer Link */}
        <div className={styles.footerLink}>
          NO ACCOUNT YET?
          <Link to="/register">CREATE ONE</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
