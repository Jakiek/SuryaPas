import { generateAssessmentId, isWellFormedAssessmentId } from "./ids";
import { canonicalJson, jsonCopy } from "./json";
import {
  AssumptionSetConflictError,
  type AppEvent,
  type Assessment,
  type AssumptionSet,
  type NewAssessment,
  type Store,
  type SunCacheEntry,
} from "./types";

type RecordedEvent = {
  name: string;
  assessmentId: string | null;
  createdAt: string;
};

// A store that keeps everything in plain Maps. Used in development and tests
// when no Supabase project is configured (SPEC 4). Data lasts as long as the
// process does.
export class MemoryStore implements Store {
  private readonly assessments = new Map<string, Assessment>();
  private readonly sunCache = new Map<string, SunCacheEntry>();
  private readonly assumptionSets = new Map<string, AssumptionSet>();
  private readonly events: RecordedEvent[] = [];

  // The clock is an argument so a test can fix the time. The default is the
  // real clock; the engine is the part that may not read the clock, not this.
  constructor(private readonly now: () => Date = () => new Date()) {}

  async createAssessment(input: NewAssessment): Promise<Assessment> {
    const assessment: Assessment = {
      ...jsonCopy(input),
      id: this.makeUnusedId(),
      createdAt: this.now().toISOString(),
      ownerId: null,
    };
    this.assessments.set(assessment.id, assessment);
    return jsonCopy(assessment);
  }

  async getAssessment(id: string): Promise<Assessment | null> {
    if (!isWellFormedAssessmentId(id)) return null;
    const found = this.assessments.get(id);
    return found ? jsonCopy(found) : null;
  }

  async getSunCache(
    cellId: string,
    year: number,
  ): Promise<SunCacheEntry | null> {
    const found = this.sunCache.get(sunCacheKey(cellId, year));
    return found ? jsonCopy(found) : null;
  }

  async putSunCache(entry: SunCacheEntry): Promise<void> {
    this.sunCache.set(sunCacheKey(entry.cellId, entry.year), jsonCopy(entry));
  }

  async recordEvent(event: AppEvent): Promise<void> {
    this.events.push({
      name: event.name,
      assessmentId: event.assessmentId ?? null,
      createdAt: this.now().toISOString(),
    });
  }

  async upsertAssumptionSet(set: AssumptionSet): Promise<void> {
    const existing = this.assumptionSets.get(set.version);
    if (existing && canonicalJson(existing.entries) !== canonicalJson(set.entries)) {
      throw new AssumptionSetConflictError(set.version);
    }
    // Same version, same entries: only the note may change.
    this.assumptionSets.set(set.version, jsonCopy(set));
  }

  // Not part of the Store interface. Lets tests see what was recorded.
  listEvents(): RecordedEvent[] {
    return jsonCopy(this.events);
  }

  // Not part of the Store interface. Lets tests read back a stored set.
  getAssumptionSet(version: string): AssumptionSet | null {
    const found = this.assumptionSets.get(version);
    return found ? jsonCopy(found) : null;
  }

  // 128 random bits make a repeat practically impossible, but the database
  // rejects a duplicate primary key, so the memory store checks as well.
  private makeUnusedId(): string {
    let id = generateAssessmentId();
    while (this.assessments.has(id)) id = generateAssessmentId();
    return id;
  }
}

function sunCacheKey(cellId: string, year: number): string {
  return `${cellId}|${year}`;
}
