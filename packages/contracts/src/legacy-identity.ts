/** Legacy identity format; a name-derived ID is not proof of authentication. */
export const generateBasicIdentity = (participantName: string, spaceName: string): string =>
  `${participantName}__${spaceName}`;

