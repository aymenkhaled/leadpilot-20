import { emailValidator } from "./email-validator";

interface GuessedEmail {
  email: string;
  pattern: string;
  confidence: number;
}

export class EmailPatternGuesser {
  private patterns = [
    { name: "first.last", fn: (f: string, l: string) => `${f}.${l}` },
    { name: "firstlast", fn: (f: string, l: string) => `${f}${l}` },
    { name: "first", fn: (f: string, _l: string) => f },
    { name: "flast", fn: (f: string, l: string) => `${f[0]}${l}` },
    { name: "firstl", fn: (f: string, l: string) => `${f}${l[0]}` },
    { name: "f.last", fn: (f: string, l: string) => `${f[0]}.${l}` },
    { name: "first_last", fn: (f: string, l: string) => `${f}_${l}` },
    { name: "last.first", fn: (f: string, l: string) => `${l}.${f}` },
    { name: "last", fn: (_f: string, l: string) => l },
    { name: "lastf", fn: (f: string, l: string) => `${l}${f[0]}` },
  ];

  async guessEmails(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<GuessedEmail[]> {
    if (!firstName || !lastName || !domain) return [];

    const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
    if (f.length < 1 || l.length < 1) return [];

    const hasMx = await emailValidator.hasMxRecord(domain);
    if (!hasMx) {
      console.log(`[PatternGuesser] Domain ${domain} has no MX records, skipping`);
      return [];
    }

    const guesses: GuessedEmail[] = [];
    const confidenceMap: Record<string, number> = {
      "first.last": 85,
      "firstlast": 75,
      "first": 70,
      "flast": 65,
      "firstl": 60,
      "f.last": 60,
      "first_last": 55,
      "last.first": 50,
      "last": 45,
      "lastf": 40,
    };

    for (const pattern of this.patterns) {
      const local = pattern.fn(f, l);
      const email = `${local}@${domain}`;
      
      const validation = await emailValidator.validateEmail(email);
      if (validation.valid) {
        guesses.push({
          email,
          pattern: pattern.name,
          confidence: confidenceMap[pattern.name] || 50,
        });
      }
    }

    return guesses;
  }

  getBestGuess(
    firstName: string,
    lastName: string,
    domain: string
  ): string | null {
    if (!firstName || !lastName || !domain) return null;
    const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
    const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
    if (f.length < 1 || l.length < 1) return null;
    return `${f}.${l}@${domain}`;
  }
}

export const emailPatternGuesser = new EmailPatternGuesser();
