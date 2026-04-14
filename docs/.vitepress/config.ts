import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

export default defineConfig({
  title: "teams",
  description: "CLI for managing Microsoft Teams apps",
  base: "/teamscli/",

  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started/installation" },
      { text: "Commands", link: "/commands/" },
      { text: "Concepts", link: "/concepts/bot-locations" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Installation", link: "/getting-started/installation" },
          { text: "Authentication", link: "/getting-started/authentication" },
          { text: "Quickstart", link: "/getting-started/quickstart" },
        ],
      },
      {
        text: "Commands",
        items: [
          { text: "Overview", link: "/commands/" },
          { text: "login", link: "/commands/login" },
          { text: "logout", link: "/commands/logout" },
          { text: "status", link: "/commands/status" },
          {
            text: "app",
            collapsed: false,
            items: [
              { text: "app (interactive)", link: "/commands/app/" },
              { text: "app list", link: "/commands/app/list" },
              { text: "app create", link: "/commands/app/create" },
              { text: "app get", link: "/commands/app/get" },
              { text: "app update", link: "/commands/app/update" },
              { text: "app doctor", link: "/commands/app/doctor" },
              { text: "app manifest download", link: "/commands/app/manifest-download" },
              { text: "app manifest upload", link: "/commands/app/manifest-upload" },
              { text: "app package download", link: "/commands/app/package-download" },
              { text: "app bot get", link: "/commands/app/bot-get" },
              { text: "app bot migrate", link: "/commands/app/bot-migrate" },
              { text: "app auth secret create", link: "/commands/app/auth-secret-create" },
            ],
          },
          {
            text: "project",
            collapsed: true,
            items: [
              { text: "project (interactive)", link: "/commands/project/" },
              { text: "project new", link: "/commands/project/new" },
              { text: "project new typescript", link: "/commands/project/new-typescript" },
              { text: "project new csharp", link: "/commands/project/new-csharp" },
              { text: "project new python", link: "/commands/project/new-python" },
              { text: "project config", link: "/commands/project/config" },
              { text: "project config add", link: "/commands/project/config-add" },
              { text: "project config remove", link: "/commands/project/config-remove" },
            ],
          },
          {
            text: "config",
            collapsed: true,
            items: [
              { text: "config (interactive)", link: "/commands/config" },
              { text: "config default-bot-location", link: "/commands/config/default-bot-location" },
              { text: "config set-lang", link: "/commands/config/set-lang" },
            ],
          },
          { text: "self-update", link: "/commands/self-update" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Bot Locations", link: "/concepts/bot-locations" },
          { text: "AAD Apps", link: "/concepts/aad-apps" },
          { text: "TDP Portal", link: "/concepts/tdp-portal" },
          { text: "SSO Architecture", link: "/concepts/sso-architecture" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "User Authentication Setup", link: "/guides/user-authentication-setup" },
        ],
      },
    ],

    search: {
      provider: "local",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/heyitsaamir/teamscli" },
    ],
  },

  vite: {
    plugins: [llmstxt()],
  },
});
