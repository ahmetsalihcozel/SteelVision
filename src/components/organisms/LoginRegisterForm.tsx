"use client";
import { useState } from "react";
import { handleLogin, handleRegister } from "@/api/handlers";

export default function LoginRegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = isLogin 
      ? await handleLogin(email, password)
      : await handleRegister(email, password, {
          firstName: "",
          lastName: "",
          isAdmin: false,
          createdAt: new Date()
        });

    if (result.success) {
      alert(isLogin ? "Giriş başarılı!" : "Kayıt başarılı!");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 p-4 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">{isLogin ? "Giriş Yap" : "Kayıt Ol"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-2 px-3 py-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-2 px-3 py-2 border rounded"
          required
        />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {isLogin ? "Giriş Yap" : "Kayıt Ol"}
        </button>
      </form>
      <button
        onClick={() => setIsLogin(!isLogin)}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        {isLogin ? "Hesabınız yok mu? Kayıt Ol" : "Zaten hesabınız var mı? Giriş Yap"}
      </button>
    </div>
  );
}
