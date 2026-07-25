export class SerializedLayoutWriter<T> {
  private inFlight = false;
  private queued = false;
  private localRevision = 0;
  private persistedRevision = 0;
  private readonly pendingSignatures = new Set<string>();

  public constructor(
    private readonly snapshot: () => T,
    private readonly persist: (value: T) => Promise<T>,
    private readonly signature: (value: T) => string,
    private readonly onPersisted: (value: T) => void,
  ) {}

  public markDirty(): void {
    this.localRevision += 1;
    this.queued = true;
  }

  public get isSaving(): boolean {
    return this.inFlight;
  }

  public get hasPendingChanges(): boolean {
    return this.localRevision !== this.persistedRevision;
  }

  public isPendingSignature(value: string): boolean {
    return this.pendingSignatures.has(value);
  }

  public acknowledgeCurrent(): void {
    this.persistedRevision = this.localRevision;
  }

  public async flush(): Promise<void> {
    if (this.inFlight) return;

    this.inFlight = true;
    try {
      while (this.queued) {
        this.queued = false;
        const revision = this.localRevision;
        const value = this.snapshot();
        const requestedSignature = this.signature(value);
        this.pendingSignatures.add(requestedSignature);

        try {
          const saved = await this.persist(value);
          this.onPersisted(saved);
          this.persistedRevision = revision;
        } finally {
          this.pendingSignatures.delete(requestedSignature);
        }

        if (this.localRevision > revision) {
          this.queued = true;
        }
      }
    } catch (error) {
      this.queued = true;
      throw error;
    } finally {
      this.inFlight = false;
    }
  }
}
