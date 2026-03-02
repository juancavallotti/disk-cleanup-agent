/**
 * Declare .md files as importable modules with a string default export.
 * Enables: import skill from "./SKILL.md"
 */
declare module "*.md" {
  const content: string;
  export default content;
}
