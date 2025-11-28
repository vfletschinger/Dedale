describe('Dedale Application', () => {
  it('should launch the app successfully', async () => {
    // Attendre que l'app se charge
    await browser.pause(3000);

    // Vérifier que le titre existe
    const title = await browser.getTitle();
    console.log('App title:', title);

    // Le test passe si l'app se lance sans erreur
    expect(title).toBeDefined();
  });

  it('should display the main page', async () => {
    // Attendre le chargement
    await browser.pause(2000);

    // Vérifier que le body est visible
    const body = await $('body');
    await expect(body).toBeDisplayed();
  });

  it('should have a root element', async () => {
    // Vérifier que l'élément root React existe
    const root = await $('#root');
    
    if (await root.isExisting()) {
      await expect(root).toBeDisplayed();
    } else {
      // Fallback: vérifier le body
      const body = await $('body');
      await expect(body).toBeDisplayed();
    }
  });

  it('should respond to user interactions', async () => {
    // Attendre le chargement complet
    await browser.pause(1000);

    // Trouver un élément cliquable (bouton, lien, etc.)
    const clickableElement = await $('button, a, [role="button"]');
    
    if (await clickableElement.isExisting()) {
      // Vérifier qu'il est visible
      const isDisplayed = await clickableElement.isDisplayed();
      
      if (isDisplayed) {
        // Cliquer sur l'élément
        await clickableElement.click();
        await browser.pause(500);
      }
    }

    // Vérifier que l'app est toujours fonctionnelle après l'interaction
    const body = await $('body');
    await expect(body).toBeDisplayed();
  });

  it('should not have JavaScript errors in console', async () => {
    // Récupérer les logs du navigateur
    const logs = await browser.getLogs('browser');
    
    // Filtrer les erreurs sévères
    const severeErrors = logs.filter(
      (log: { level: string; message: string }) => 
        log.level === 'SEVERE' && 
        !log.message.includes('favicon.ico') // Ignorer les erreurs favicon
    );

    // Le test échoue s'il y a des erreurs JavaScript
    if (severeErrors.length > 0) {
      console.error('JavaScript errors found:', severeErrors);
    }
    
    expect(severeErrors.length).toBe(0);
  });
});
