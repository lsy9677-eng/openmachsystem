try {
  await import('./development-guard.js');
  const { requireEmulators } = await import('./environment.js');
  await requireEmulators();
  await import('./app.js?v=510128');
} catch (error) {
  document.body.replaceChildren();
  const message = document.createElement('p');
  message.id = 'environment-error';
  message.textContent = `230MATCH 실행 중단: ${error.message}`;
  document.body.append(message);
  console.error(error);
}
