// Vite's ?raw suffix imports a file as text. The schema test reads the data model that way.
declare module '*?raw' {
  const text: string;
  export default text;
}
