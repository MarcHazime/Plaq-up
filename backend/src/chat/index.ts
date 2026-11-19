import { prisma } from '../db';
import { createChat } from './chat';
import { createPrismaChatStore } from './prismaStore';
import type { ChatEvents } from './types';

export const chatStore = createPrismaChatStore(prisma);

/** Chat wired to the real database. Pass events to react to sent messages (sockets, push). */
export const chatWith = (events?: ChatEvents) => createChat({ store: chatStore, events });

export const chat = chatWith();

export type { DenyReason, QuotaStatus } from './types';
