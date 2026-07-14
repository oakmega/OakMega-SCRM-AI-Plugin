> 同步自 OakMega-SCRM-Back/ai_agent/docs/agent_tools_api.md（2026-07-14）

## `member get-channel-line`

### CLI

```
member get-channel-line
  --member-id <id>    # 必填，會員 workspace_member_id
```

取得會員在 LINE 的渠道綁定身分。**未綁定 LINE 時回 404。**

### Response `200 OK`

```json
{
  "workspace_member_id": 123,
  "channel": "LINE",
  "social_media_member_id": 456,
  "social_media_channel_id": 10,
  "social_media_channel_name": "官方帳號",
  "uuid": "Uabc123",
  "display_name": "王小明",
  "profile_url": "https://...",
  "is_available": true,
  "join_dt": "2024-01-01 00:00:00",
  "block_dt": null,
  "service_list_id": 789,
  // 1. FRIEND: 已加好友 2. BLOCKED: 已封鎖 3. LINE_LOGIN: 僅 LINE Login（未加好友）
  "line_status": "FRIEND"
}
```
