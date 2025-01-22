import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { mcpServersTable, McpServerStatus } from '@/db/schema';

import { authenticateApiKey } from '../auth';

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const activeMcpServers = await db
      .select()
      .from(mcpServersTable)
      .where(
        and(
          eq(mcpServersTable.status, McpServerStatus.ACTIVE),
          eq(mcpServersTable.profile_uuid, auth.activeProfile.uuid)
        )
      );
    return NextResponse.json(activeMcpServers);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch active MCP servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { uuid, name, description, command, args, env, status } = body;

    const newMcpServer = await db
      .insert(mcpServersTable)
      .values({
        uuid,
        name,
        description,
        command,
        args,
        env,
        status,
        profile_uuid: auth.activeProfile.uuid,
      })
      .returning();

    return NextResponse.json(newMcpServer[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to create MCP server' },
      { status: 500 }
    );
  }
}
