import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

admin.initializeApp();

// Configurer le transporteur d'email (ex: en utilisant Gmail)
// L'idéal est de stocker ces identifiants dans les secrets de Firebase ou les variables d'environnement.
// firebase functions:config:set gmail.email="votre.email@gmail.com" gmail.password="votre-mot-de-passe"
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "votre.email@gmail.com",
    pass: process.env.EMAIL_PASS || "votre-mot-de-passe",
  },
});

export const envoyerResumeHebdomadaire = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      
      // Calculer la date d'il y a 7 jours
      const septJoursAvant = new Date();
      septJoursAvant.setDate(septJoursAvant.getDate() - 7);

      // On récupère toutes les entreprises
      const companiesSnapshot = await db.collection("companies").get();

      for (const companyDoc of companiesSnapshot.docs) {
        const companyId = companyDoc.id;
        const companyData = companyDoc.data();
        const userId = companyData.userId;

        // Récupérer le total des revenus de la semaine dernière pour cette entreprise
        const revenuesSnapshot = await db
          .collection("revenues")
          .where("companyId", "==", companyId)
          // Si vous avez un champ date dans `revenues` :
          // .where("date", ">=", septJoursAvant)
          .get();

        let totalHebdomadaire = 0;
        let nbRevenus = 0;

        revenuesSnapshot.forEach((doc) => {
          const data = doc.data();
          // On s'assure que le champ existe et qu'il a été créé ces 7 derniers jours (selon votre structure de données)
          if (data.createdAt && data.createdAt.toDate() >= septJoursAvant) {
            totalHebdomadaire += Number(data.revenue || 0);
            nbRevenus++;
          }
        });

        // Envoyer l'email si on a un utilisateur et qu'il y a eu de l'activité ou qu'on veut envoyer un bilan générique
        if (userId) {
          // On peut aller chercher l'email de l'utilisateur avec Admin SDK si Auth est utilisé
          try {
            const userRecord = await admin.auth().getUser(userId);
            const userEmail = userRecord.email;

            if (userEmail) {
              const mailOptions = {
                from: "Reveno App <noreply@reveno.com>",
                to: userEmail,
                subject: `Votre résumé hebdomadaire - ${companyData.name}`,
                html: `
                  <h2>Bonjour, voici votre résumé hebdomadaire pour ${companyData.name}</h2>
                  <p>La semaine dernière, vous avez enregistré <strong>${nbRevenus}</strong> entrée(s) de revenus.</p>
                  <p>Total généré sur les 7 derniers jours : <strong>${totalHebdomadaire.toFixed(2)} €</strong></p>
                  <br>
                  <p>Continuez sur votre lancée !</p>
                  <p>L'équipe Reveno</p>
                `,
              };

              await transporter.sendMail(mailOptions);
              console.log(`Email envoyé avec succès à ${userEmail} pour ${companyData.name}`);
            }
          } catch (authErr) {
            console.error("Erreur lors de la récupération de l'utilisateur:", authErr);
          }
        }
      }

      console.log("Processus de résumé hebdomadaire terminé.");
      return null;
    } catch (error) {
      console.error("Erreur générale lors de l'envoi du résumé hebdomadaire: ", error);
      return null;
    }
  });

export const envoyerRapportMensuel = functions.pubsub
  .schedule("1 of month 08:00") // 1er de chaque mois à 8h00
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const maintenant = new Date();
      // Le rapport concerne le mois précédent (puisqu'on le lance le 1er du mois suivant)
      const premierJourMoisDernier = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
      const dernierJourMoisDernier = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0, 23, 59, 59);

      const nomMois = premierJourMoisDernier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const companiesSnapshot = await db.collection("companies").get();

      // Fonction utilitaire pour générer le PDF
      const generatePDFBuffer = (companyName: string, revenus: number, nbRevenus: number, depenses: number, nbDepenses: number): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const doc = new PDFDocument();
          const buffers: Buffer[] = [];
          doc.on("data", buffers.push.bind(buffers));
          doc.on("end", () => resolve(Buffer.concat(buffers)));
          doc.on("error", reject);

          doc.fontSize(22).text(`Rapport Mensuel - ${companyName}`, { align: "center" });
          doc.moveDown();
          doc.fontSize(16).text(`Période : ${nomMois}`, { align: "center" });
          doc.moveDown();
          doc.moveDown();
          
          doc.fontSize(14).text(`Bilan des Revenus`, { underline: true });
          doc.fontSize(12).text(`Nombre d'entrées : ${nbRevenus}`);
          doc.text(`Total : ${revenus.toFixed(2)} €`);
          doc.moveDown();
          
          doc.fontSize(14).text(`Bilan des Dépenses`, { underline: true });
          doc.fontSize(12).text(`Nombre de sorties : ${nbDepenses}`);
          doc.text(`Total : ${depenses.toFixed(2)} €`);
          doc.moveDown();
          doc.moveDown();
          
          const solde = revenus - depenses;
          doc.fontSize(16).text(`Solde du mois : ${solde.toFixed(2)} €`, {
            underline: true,
            stroke: true
          });
          
          doc.end();
        });
      };

      for (const companyDoc of companiesSnapshot.docs) {
        const companyId = companyDoc.id;
        const companyData = companyDoc.data();
        const userId = companyData.userId;

        if (!userId) continue;

        // Requêtes
        const revenuesRef = db.collection("revenues").where("companyId", "==", companyId);
        const expensesRef = db.collection("expenses").where("companyId", "==", companyId);

        const [revSnap, expSnap] = await Promise.all([revenuesRef.get(), expensesRef.get()]);

        let totalRev = 0, nbRev = 0;
        let totalExp = 0, nbExp = 0;

        revSnap.forEach((doc) => {
          const d = doc.data();
          if (d.createdAt) {
            const date = d.createdAt.toDate();
            if (date >= premierJourMoisDernier && date <= dernierJourMoisDernier) {
              totalRev += Number(d.revenue || 0);
              nbRev++;
            }
          }
        });

        expSnap.forEach((doc) => {
          const d = doc.data();
          if (d.createdAt) {
            const date = d.createdAt.toDate();
            if (date >= premierJourMoisDernier && date <= dernierJourMoisDernier) {
              totalExp += Number(d.amount || d.expense || 0);
              nbExp++;
            }
          }
        });

        // Génération et envoi si on a de l'activité
        if (nbRev > 0 || nbExp > 0) {
          try {
            const userRecord = await admin.auth().getUser(userId);
            if (userRecord.email) {
              const pdfBuffer = await generatePDFBuffer(companyData.name || "Votre Entreprise", totalRev, nbRev, totalExp, nbExp);

              const mailOptions = {
                from: "Reveno App <noreply@reveno.com>",
                to: userRecord.email,
                subject: `Rapport Mensuel (${nomMois}) - ${companyData.name}`,
                html: `
                  <h2>Bonjour, voici votre rapport mensuel complet pour ${companyData.name}.</h2>
                  <p>Veuillez trouver ci-joint le résumé PDF contenant toutes vos transactions du mois de <strong>${nomMois}</strong>.</p>
                  <p>Total des revenus : <strong>${totalRev.toFixed(2)} €</strong></p>
                  <p>Total des dépenses : <strong>${totalExp.toFixed(2)} €</strong></p>
                  <br>
                  <p>À très vite sur Reveno,</p>
                `,
                attachments: [
                  {
                    filename: `Rapport_Mensuel_${nomMois.replace(/ /g, "_")}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf"
                  }
                ]
              };

              await transporter.sendMail(mailOptions);
              console.log(`Rapport mensuel PDF envoyé à ${userRecord.email}`);
            }
          } catch (e) {
            console.error("Erreur lors de l'envoi du mail / génération PDF:", e);
          }
        }
      }

      console.log("Rapports mensuels générés et envoyés (PDF).");
      return null;
    } catch (e) {
      console.error("Erreur générale rapports mensuels:", e);
      return null;
    }
  });
