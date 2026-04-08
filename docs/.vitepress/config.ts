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
              { text: "app view", link: "/commands/app/view" },
              { text: "app edit", link: "/commands/app/edit" },
              { text: "app doctor", link: "/commands/app/doctor" },
              { text: "app manifest download", link: "/commands/app/manifest-download" },
              { text: "app package download", link: "/commands/app/package-download" },
              { text: "app bot status", link: "/commands/app/bot-status" },
              { text: "app bot migrate", link: "/commands/app/bot-migrate" },
              { text: "app auth secret create", link: "/commands/app/auth-secret-create" },
              { text: "app user-auth oauth add", link: "/commands/app/user-auth-oauth-add" },
              { text: "app user-auth oauth list", link: "/commands/app/user-auth-oauth-list" },
              { text: "app user-auth oauth remove", link: "/commands/app/user-auth-oauth-remove" },
              { text: "app user-auth sso setup", link: "/commands/app/user-auth-sso-setup" },
              { text: "app user-auth sso list", link: "/commands/app/user-auth-sso-list" },
              { text: "app user-auth sso edit", link: "/commands/app/user-auth-sso-edit" },
              { text: "app user-auth sso remove", link: "/commands/app/user-auth-sso-remove" },
            ],
          },
          {
            text: "scaffold",
            collapsed: true,
            items: [
              { text: "scaffold manifest", link: "/commands/scaffold/manifest" },
            ],
          },
          { text: "config", link: "/commands/config" },
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
