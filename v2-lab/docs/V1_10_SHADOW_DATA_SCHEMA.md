# Shadow snapshot schema

Collection default:
`mainV2ShadowTests`

Document fields:
- schemaVersion
- shadowOnly
- savedAt
- sourceKey
- drawSize
- summary
- source
- payloadJson

`payloadJson` includes the complete V2 state and is never written back to the legacy app automatically.
