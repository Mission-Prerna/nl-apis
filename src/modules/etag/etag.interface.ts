export type Etag = {
  etag: string
}

export interface EtagInterface {
  getEtag(forKey: string | number, ttl?: number): Promise<Etag>
}