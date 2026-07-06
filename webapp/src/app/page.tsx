export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-lg space-y-4 text-center sm:text-left">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Fix Posture · webapp
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Andamiaje listo.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Next.js 16 + Tailwind 4 + Supabase clients preparados. Próximo paso:
          conectar credenciales de Supabase y empezar el spike de MediaPipe.
        </p>
      </div>
    </main>
  );
}
