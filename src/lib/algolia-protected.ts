import type { SearchClient } from "algoliasearch";
import algoliasearch from "algoliasearch";

import { env } from "../env";

class AlgoliaElevatedClient {
  private static instance: AlgoliaElevatedClient | undefined = undefined;

  private client: SearchClient;

  private constructor() {
    this.client = algoliasearch(
      env.NEXT_PUBLIC_ALGOLIA_ID,
      env.ALGOLIA_ADMIN_KEY,
    );
  }

  public static getInstance(): AlgoliaElevatedClient {
    if (!AlgoliaElevatedClient.instance) {
      AlgoliaElevatedClient.instance = new AlgoliaElevatedClient();
    }

    return AlgoliaElevatedClient.instance;
  }

  public getClient(): SearchClient {
    return this.client;
  }
}

export const algolia_protected = AlgoliaElevatedClient.getInstance();
