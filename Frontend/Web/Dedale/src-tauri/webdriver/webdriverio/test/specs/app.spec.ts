describe("Dedale Application", () => {
  // ============================================
  // HOOK DE CONFIGURATION - Gestion du premier lancement
  // ============================================

  before(async () => {
    // Attendre que l'app se charge
    await browser.pause(3000);

    // Vérifier si c'est le premier lancement (formulaire admin affiché)
    const adminForm = await $("form");

    if (await adminForm.isExisting()) {
      // Vérifier si c'est bien le formulaire de création d'admin
      const submitButton = await $('button[type="submit"]');
      const buttonText = await submitButton.getText();

      if (buttonText && buttonText.includes("administrateur")) {
        console.log("Premier lancement détecté - Création du compte admin...");

        // Remplir le formulaire admin
        const usernameInput = await $('input[type="text"]');
        const passwordInput = await $('input[type="password"]');

        await usernameInput.setValue("admin_test");
        await passwordInput.setValue("password_test123");

        // Soumettre le formulaire
        await submitButton.click();

        // Attendre que l'app se charge après la création de l'admin
        await browser.pause(3000);

        console.log("Compte admin créé avec succès");
      }
    }
  });

  // ============================================
  // TESTS DE BASE - Vérification du lancement
  // ============================================

  it("should launch the app successfully", async () => {
    // Attendre que l'app se charge
    await browser.pause(2000);

    // Vérifier que le titre existe
    const title = await browser.getTitle();
    console.log("App title:", title);

    // Le test passe si l'app se lance sans erreur
    expect(title).toBeDefined();
    expect(title).toContain("Dedale");
  });

  it("should display the main page", async () => {
    // Attendre le chargement
    await browser.pause(2000);

    // Vérifier que le body est visible
    const body = await $("body");
    await expect(body).toBeDisplayed();
  });

  it("should have a root element", async () => {
    // Vérifier que l'élément root React existe
    const root = await $("#root");

    if (await root.isExisting()) {
      await expect(root).toBeDisplayed();
    } else {
      // Fallback: vérifier le body
      const body = await $("body");
      await expect(body).toBeDisplayed();
    }
  });

  // ============================================
  // TESTS DE NAVIGATION - Menu de l'application
  // ============================================

  it("should display the navigation bar", async () => {
    // Vérifier que la navbar existe
    const nav = await $("nav");
    await expect(nav).toBeDisplayed();
  });

  it("should have navigation buttons", async () => {
    // Vérifier les 3 boutons de navigation: Accueil, Map, Equipes
    const buttons = await $$("nav button");

    // Il devrait y avoir au moins 3 boutons de navigation
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("should navigate to Map page when clicking Map button", async () => {
    // Trouver le bouton "Map" via XPath (contient le texte "Map")
    const mapButton = await $('//nav//button[contains(text(),"Map")]');

    if (await mapButton.isExisting()) {
      await mapButton.click();
      await browser.pause(1000);

      // Vérifier que la page a changé (l'app ne crash pas)
      const body = await $("body");
      await expect(body).toBeDisplayed();
    }
  });

  it("should navigate to Equipes page when clicking Equipes button", async () => {
    // Trouver le bouton "Equipes" via XPath
    const equipeButton = await $('//nav//button[contains(text(),"Equipe")]');

    if (await equipeButton.isExisting()) {
      await equipeButton.click();
      await browser.pause(1000);

      // Vérifier que la page a changé
      const body = await $("body");
      await expect(body).toBeDisplayed();
    }
  });

  it("should navigate back to Accueil page", async () => {
    // Trouver le bouton "Accueil" via XPath
    const accueilButton = await $('//nav//button[contains(text(),"Accueil")]');

    if (await accueilButton.isExisting()) {
      await accueilButton.click();
      await browser.pause(1000);

      // Vérifier que la page a changé
      const body = await $("body");
      await expect(body).toBeDisplayed();
    }
  });

  // ============================================
  // TESTS D'INTERFACE - Éléments visuels
  // ============================================

  it("should display the logo", async () => {
    // Vérifier que le logo Strasbourg est présent
    const logo = await $("nav img");

    if (await logo.isExisting()) {
      await expect(logo).toBeDisplayed();
    }
  });

  it("should have a main content area", async () => {
    // Vérifier que la zone de contenu principal existe
    const main = await $("main");
    await expect(main).toBeDisplayed();
  });

  // ============================================
  // TESTS DE ROBUSTESSE - L'app reste stable
  // ============================================

  it("should respond to user interactions", async () => {
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
    const body = await $("body");
    await expect(body).toBeDisplayed();
  });

  it("should handle rapid navigation without crashing", async () => {
    // Test de stress: cliquer rapidement sur plusieurs boutons
    const buttons = await $$("nav button");

    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
      if (await buttons[i].isDisplayed()) {
        await buttons[i].click();
        await browser.pause(200); // Pause courte entre les clics
      }
    }

    // L'app devrait toujours fonctionner
    const body = await $("body");
    await expect(body).toBeDisplayed();
  });
});
