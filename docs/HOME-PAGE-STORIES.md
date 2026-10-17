# Home-page stories

In a Longmont business or professional profile, open **Edit & publish the live business page → Home-page business or professional story**.

1. Add the text in **Business story**.
2. Enable **Spotlight story on Loving Longmont home page**.
3. Choose the logo, left image, third image, any combination, or none. The left image is the first visible gallery photo; the third image is the second visible gallery photo (the additional photo after the left image). Thumbnails show the actual selections. Reordering or hiding profile photos changes these positions.
4. Preview the live business page and review **Home-page story highlight**.
5. Publish. To remove a highlight, uncheck it, preview, and publish again.

The home article uses the full published story and only the chosen images. Address, contact information, descriptions, and services are not included in the article. Selected images must also be visible in the published profile. The article links to the individual profile for full business details.

Highlights are optional and default off. Draft edits never change live posts until publication. The existing signed-preview, optimistic version checks, workspace access, and public-field selection remain in force. `home_story` is part of the public snapshot, so no private settings endpoint is queried by the public home page. Existing publications are not automatically highlighted.

Public rendering lives in `src/lib/home-stories.mjs`, copied to `public/live/home-stories.mjs` during builds and mirrored to Loving Longmont. The home page contains `#home-business-stories`; the existing publication loader renders that section and prevents a duplicate regular listing for the same highlighted profile. Other page placements are unaffected. New professional profiles using this editor have the same story option.
