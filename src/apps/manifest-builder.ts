import { input, checkbox } from "@inquirer/prompts";

/**
 * Placeholder bot ID for manifest generation when no real bot ID is available.
 */
export const PLACEHOLDER_BOT_ID = "00000000-0000-0000-0000-000000000000";

export interface ManifestCustomization {
  description?: { short: string; full?: string };
  scopes?: string[];
  developer?: {
    name: string;
    websiteUrl: string;
    privacyUrl: string;
    termsOfUseUrl: string;
  };
}

/**
 * Interactively collects manifest customization options from the user.
 * Prompts for description, scopes, and developer details.
 */
export async function collectManifestCustomization(): Promise<ManifestCustomization> {
  const customizeFields = await checkbox({
    message: "Customize manifest fields? (space to select, enter to continue)",
    choices: [
      { name: "Description", value: "description" },
      { name: "Scopes", value: "scopes" },
      { name: "Developer details", value: "developer" },
    ],
  });

  const result: ManifestCustomization = {};

  if (customizeFields.includes("description")) {
    const shortDesc = await input({ message: "Short description:" });
    const fullDesc = await input({ message: "Full description (leave empty to use short):" });
    result.description = { short: shortDesc, full: fullDesc || undefined };
  }

  if (customizeFields.includes("scopes")) {
    result.scopes = await checkbox({
      message: "Select bot scopes:",
      choices: [
        { name: "Personal", value: "personal", checked: true },
        { name: "Team", value: "team", checked: true },
        { name: "Group Chat", value: "groupchat", checked: true },
      ],
    });
  }

  if (customizeFields.includes("developer")) {
    const devName = await input({ message: "Developer name:" });
    const websiteUrl = await input({ message: "Website URL:" });
    const privacyUrl = await input({ message: "Privacy URL:" });
    const termsUrl = await input({ message: "Terms of use URL:" });
    result.developer = {
      name: devName,
      websiteUrl,
      privacyUrl,
      termsOfUseUrl: termsUrl,
    };
  }

  return result;
}
