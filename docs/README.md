# StrideIQ documentation

| Document | Audience | Contents |
|----------|----------|----------|
| [../README.md](../README.md) | Everyone | Setup, routes, env, quick reference |
| [../PRODUCT.md](../PRODUCT.md) | Product / eng | Positioning, IA rules, roadmap phases |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Engineers | Layers, data paths, API, folder map |
| [COACH_AND_INTELLIGENCE.md](COACH_AND_INTELLIGENCE.md) | Product + eng | Athlete model vs conversational Coach |
| [DIFFERENTIATION_NORTH_STAR.md](DIFFERENTIATION_NORTH_STAR.md) | Strategy | Moat features, reasoning primitives |
| [MCP_AND_CHAT_PLAN.md](MCP_AND_CHAT_PLAN.md) | Eng (historical) | Early MCP/chat design notes |
| [ROADMAP_10_FEATURES.md](ROADMAP_10_FEATURES.md) | Product | Feature backlog framing |
| [../packages/strideiq-mcp/README.md](../packages/strideiq-mcp/README.md) | Integrators | MCP server setup |

## Mental model

```
Strava data → domain model → analytics engines → insights + intelligence bundle
                                                      ↓
                              ┌───────────────────────┴───────────────────────┐
                              │                                               │
                       /intelligence (belief UI)                    /coach (investigation UI)
                              │                                               │
                              └───────────────────────┬───────────────────────┘
                                                      ↓
                                            LLM + tool loop (server)
```
