/**
 * Base serializer.
 * Subclasses implement `serialize(record)` to shape a single record.
 * `collection()` maps an array through `serialize()`.
 *
 * `embed` and `pick` are shared composition helpers so resource serializers
 * (worker/review/job/...) don't each re-implement the same
 * "conditionally nest a related serializer" / "narrow to a subset of fields"
 * logic.
 */
export abstract class BaseSerializer<TInput, TOutput> {
  abstract serialize(record: TInput): TOutput

  collection(records: TInput[]): TOutput[] {
    return records.map((r) => this.serialize(r))
  }

  /**
   * Conditionally serialize a related record with another serializer and
   * nest it under `key`. Returns `{}` (spreadable no-op) when the relation
   * wasn't loaded, matching the `...(x ? { key: ... } : {})` pattern that
   * used to be duplicated across worker/review serializers.
   */
  protected embed<K extends string, R, S>(
    key: K,
    relation: R | null | undefined,
    serializer: BaseSerializer<R, S>,
  ): { [P in K]?: S } {
    if (!relation) return {} as { [P in K]?: S }
    return { [key]: serializer.serialize(relation) } as { [P in K]?: S }
  }

  /** Narrow an already-serialized record to a fixed set of fields. */
  protected pick<T extends object, K extends keyof T>(record: T, keys: readonly K[]): Pick<T, K> {
    const result = {} as Pick<T, K>
    for (const key of keys) result[key] = record[key]
    return result
  }
}
