"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  message?: string;
  redirectTo?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- Lógica de inicio de sesión (sin cambios) ---
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const result = (await response.json()) as LoginResponse;

    if (!response.ok || !result.redirectTo) {
      setErrorMessage(
        result.message ?? "No fue posible iniciar sesión. Inténtalo de nuevo.",
      );
      setIsSubmitting(false);
      return;
    }

    router.replace(result.redirectTo);
    router.refresh();
  }

  return (
    <main className="grid min-h-screen bg-[#fafafa] lg:grid-cols-[1fr_1fr]">
      {/* Panel izquierdo: marca y mensaje */}
      <aside className="relative hidden overflow-hidden bg-[#0d5c57] text-white lg:flex lg:flex-col lg:justify-between lg:p-16">
        {/* Anillos decorativos */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-48 h-[560px] w-[560px] rounded-full bg-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-28 h-[420px] w-[420px] rounded-full border-[48px] border-white/[0.05]"
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a8e6cf] text-[#0d5c57]">
            <svg
              aria-hidden="true"
              fill="none"
              height="22"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="22"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
            </svg>
          </span>
          <span className="text-xl font-bold leading-tight">
            Parquea
            <br />
            <span className="text-[#a8e6cf]">Fácil</span>
          </span>
        </div>

        {/* Mensaje principal */}
        <div className="relative max-w-lg">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#a8e6cf]">
            Gestión inteligente de parqueaderos
          </p>
          <h2 className="mt-5 text-[4.25rem] font-medium leading-[0.95] tracking-tight">
            Más control.
            <br />
            <span className="text-[#a8e6cf]">Menos vueltas.</span>
          </h2>
          <p className="mt-8 max-w-md text-lg leading-8 text-white/75">
            La operación de tu parqueadero, clara y bajo control desde el primer
            ingreso hasta el último pago.
          </p>
        </div>

        {/* Pie con beneficios */}
        <ul className="relative flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
          <li className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Operación segura
          </li>
          <li className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
            Información en tiempo real
          </li>
        </ul>
      </aside>

      {/* Panel derecho: formulario */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[470px]">
          {/* Logo visible solo en móvil */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d5c57] text-[#a8e6cf]">
              <svg
                aria-hidden="true"
                fill="none"
                height="22"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="22"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
              </svg>
            </span>
            <span className="text-xl font-bold text-[#0d5c57]">
              Parquea Fácil
            </span>
          </div>

          <p className="text-xs font-bold tracking-[0.18em] text-[#0d5c57]">
            Bienvenido de nuevo
          </p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight text-[#14302e]">
            Inicia sesión
          </h1>
          <p className="mt-4 text-sm text-neutral-500">
            Ingresa tus datos para acceder al panel de operación.
          </p>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-[#14302e]"
                htmlFor="email"
              >
                Correo electrónico
              </label>
              <input
                autoComplete="email"
                className="h-[54px] w-full rounded-lg border border-neutral-200 bg-white px-4 text-sm text-[#14302e] outline-none transition placeholder:text-neutral-400 focus:border-[#0d5c57] focus:ring-2 focus:ring-[#0d5c57]/20 disabled:opacity-60"
                disabled={isSubmitting}
                id="email"
                name="email"
                placeholder="operador@parqueafacil.co"
                required
                type="email"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-[#14302e]"
                htmlFor="password"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  autoComplete="current-password"
                  className="h-[54px] w-full rounded-lg border border-neutral-200 bg-white pl-4 pr-20 text-sm text-[#14302e] outline-none transition focus:border-[#0d5c57] focus:ring-2 focus:ring-[#0d5c57]/20 disabled:opacity-60"
                  disabled={isSubmitting}
                  id="password"
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded text-xs font-semibold text-[#0d5c57] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0d5c57]/40"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-neutral-500">
                <input
                  className="h-4 w-4 cursor-pointer rounded accent-[#0d5c57]"
                  defaultChecked
                  name="remember"
                  type="checkbox"
                />
                Recuérdame
              </label>
              <a
                className="font-semibold text-[#0d5c57] hover:underline"
                href="/forgot-password"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {errorMessage ? (
              <p
                aria-live="polite"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#0d5c57] text-sm font-semibold text-white transition hover:bg-[#0a4a46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c57] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                "Ingresando…"
              ) : (
                <>
                  Ingresar al panel
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="18"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}