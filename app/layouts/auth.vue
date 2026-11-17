<template>
  <div class="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
    <div class="mb-4 self-end sm:absolute sm:end-6 sm:top-5">
      <LanguageSwitcher />
    </div>
    <div class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <AppIcon name="book" />
        </div>
        <h1 class="text-xl font-bold text-slate-900">{{ $t('app.name') }}</h1>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <slot />
      </div>
    </div>
  </div>
</template>
