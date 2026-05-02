interface EmailPattern {
  pattern: string;
  confidence: number;
}

export class EmailPatternInference {
  private patterns = [
    { pattern: "first.last", generate: (f: string, l: string) => `${f}.${l}` },
    { pattern: "firstlast", generate: (f: string, l: string) => `${f}${l}` },
    { pattern: "first_last", generate: (f: string, l: string) => `${f}_${l}` },
    { pattern: "f.last", generate: (f: string, l: string) => `${f.charAt(0)}.${l}` },
    { pattern: "flast", generate: (f: string, l: string) => `${f.charAt(0)}${l}` },
    { pattern: "first.l", generate: (f: string, l: string) => `${f}.${l.charAt(0)}` },
    { pattern: "firstl", generate: (f: string, l: string) => `${f}${l.charAt(0)}` },
    { pattern: "first", generate: (f: string) => f },
    { pattern: "last.first", generate: (f: string, l: string) => `${l}.${f}` },
    { pattern: "lastf", generate: (f: string, l: string) => `${l}${f.charAt(0)}` },
  ];

  inferPattern(knownEmails: string[], domain: string): EmailPattern | null {
    if (!knownEmails.length) return null;

    const patternMatches: Record<string, number> = {};

    for (const email of knownEmails) {
      const localPart = email.split("@")[0]?.toLowerCase();
      if (!localPart) continue;

      if (localPart.includes(".")) {
        patternMatches["first.last"] = (patternMatches["first.last"] || 0) + 1;
      } else if (localPart.includes("_")) {
        patternMatches["first_last"] = (patternMatches["first_last"] || 0) + 1;
      } else if (localPart.length <= 2) {
        patternMatches["fl"] = (patternMatches["fl"] || 0) + 1;
      } else {
        patternMatches["firstlast"] = (patternMatches["firstlast"] || 0) + 1;
      }
    }

    const sortedPatterns = Object.entries(patternMatches).sort(
      (a, b) => b[1] - a[1]
    );

    if (sortedPatterns.length > 0) {
      const topPattern = sortedPatterns[0][0];
      const confidence = Math.min(
        95,
        50 + sortedPatterns[0][1] * 15
      );
      return { pattern: topPattern, confidence };
    }

    return null;
  }

  generateEmail(
    firstName: string,
    lastName: string,
    domain: string,
    patternHint?: string
  ): string[] {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const last = lastName.toLowerCase().replace(/[^a-z]/g, "");

    if (!first || !last) {
      return first ? [`${first}@${domain}`] : [];
    }

    const candidates: string[] = [];

    if (patternHint) {
      const matchingPattern = this.patterns.find((p) => p.pattern === patternHint);
      if (matchingPattern) {
        candidates.push(`${matchingPattern.generate(first, last)}@${domain}`);
      }
    }

    for (const p of this.patterns) {
      const email = `${p.generate(first, last)}@${domain}`;
      if (!candidates.includes(email)) {
        candidates.push(email);
      }
    }

    return candidates.slice(0, 5);
  }

  generateCandidatesForRoles(
    domain: string,
    roles: Array<{ firstName: string; lastName: string; title: string }>,
    patternHint?: string
  ): Array<{
    firstName: string;
    lastName: string;
    title: string;
    emailCandidates: string[];
  }> {
    return roles.map((role) => ({
      firstName: role.firstName,
      lastName: role.lastName,
      title: role.title,
      emailCandidates: this.generateEmail(
        role.firstName,
        role.lastName,
        domain,
        patternHint
      ),
    }));
  }
}

export const emailPatternInference = new EmailPatternInference();
