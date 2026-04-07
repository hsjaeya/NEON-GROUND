import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Auth.module.css";

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
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
    if (!formData.username.trim()) {
      setError("사용자명을 입력해주세요");
      return false;
    }
    if (formData.username.length < 3) {
      setError("사용자명은 3자 이상이어야 합니다");
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("유효한 이메일을 입력해주세요");
      return false;
    }
    if (formData.password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
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
    const result = await register(
      formData.username,
      formData.email,
      formData.password,
    );

    if (result.success) {
      setSuccess(true);
      setFormData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        navigate("/home");
      }, 1500);
    } else {
      setError(result.error || authError || "회원가입 실패");
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

        <div className={styles.authHeader}>
          <div className={styles.authLogo}>◇ NEON GROUND ◇</div>
          <h1 className={styles.authTitle}>
            CREATE <span>ACCOUNT</span>
          </h1>
          <p className={styles.authSubtitle}>// initialize system access //</p>
        </div>

        {success && (
          <div className={styles.successBox}>
            ✓ ACCOUNT CREATED SUCCESSFULLY · INITIALIZING VAULT...
          </div>
        )}

        {(error || authError) && (
          <div className={styles.errorBox}>✗ {error || authError}</div>
        )}

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>USERNAME</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="enter username"
              className={styles.formInput}
              disabled={isLoading || success}
            />
          </div>

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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>PASSWORD</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="min 6 characters"
              className={styles.formInput}
              disabled={isLoading || success}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>CONFIRM PASSWORD</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="re-enter password"
              className={styles.formInput}
              disabled={isLoading || success}
            />
          </div>

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
                <div className={styles.loadingSpinner} /> INITIALIZING
              </span>
            ) : (
              "▶ CREATE ACCOUNT"
            )}
          </button>
        </form>

        <div style={{ margin: "24px 0" }} className={styles.divider} />

        <div className={styles.footerLink}>
          ALREADY HAVE ACCOUNT?
          <Link to="/login">SIGN IN</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
