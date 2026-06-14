import { useCallback, useEffect, useMemo, useState } from 'react'
import usePartySocket from 'partysocket/react'

import {
  type ChatMessage,
  type Difficulty,
  type GameSnapshot,
  type Player,
  type ServerMessage,
} from '../../shared/protocol'

const PARTYKIT_HOST =
  (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ?? 'localhost:1999'

export type ConnectionStatus = 'connecting' | 'online' | 'offline'

export interface PartyGame {
  status: ConnectionStatus
  selfId: string | null
  game: GameSnapshot | null
  players: Player[]
  messages: ChatMessage[]
  setCursor: (index: number | null) => void
  fill: (index: number, value: number) => void
  sendChat: (text: string) => void
  reset: (difficulty: Difficulty) => void
  join: (name: string, color: string) => void
}

export function usePartyGame(room: string, profile: {
  name: string
  color: string
} | null): PartyGame {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [selfId, setSelfId] = useState<string | null>(null)
  const [game, setGame] = useState<GameSnapshot | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room,
    onOpen() {
      // Going online triggers the identity-sync effect below, which
      // (re)announces our profile to the room.
      setStatus('online')
    },
    onClose() {
      setStatus('offline')
    },
    onError() {
      setStatus('offline')
    },
    onMessage(event: MessageEvent) {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }
      switch (msg.type) {
        case 'snapshot':
          setSelfId(msg.self)
          setGame(msg.game)
          setPlayers(msg.players)
          setMessages(msg.messages)
          break
        case 'values':
          setGame((g) => (g ? { ...g, values: msg.values, solved: msg.solved } : g))
          break
        case 'players':
          setPlayers(msg.players)
          break
        case 'chat':
          setMessages((m) => [...m, msg.message])
          break
        case 'reset':
          setGame(msg.game)
          break
      }
    },
  })

  const send = useCallback(
    (data: unknown) => socket.send(JSON.stringify(data)),
    [socket],
  )

  // Push identity whenever the profile changes after the socket is open.
  useEffect(() => {
    if (profile && status === 'online') {
      send({ type: 'join', name: profile.name, color: profile.color })
    }
  }, [profile, status, send])

  const setCursor = useCallback(
    (index: number | null) => send({ type: 'cursor', index }),
    [send],
  )
  const fill = useCallback(
    (index: number, value: number) => send({ type: 'fill', index, value }),
    [send],
  )
  const sendChat = useCallback((text: string) => send({ type: 'chat', text }), [send])
  const reset = useCallback(
    (difficulty: Difficulty) => send({ type: 'reset', difficulty }),
    [send],
  )
  const join = useCallback(
    (name: string, color: string) => send({ type: 'join', name, color }),
    [send],
  )

  return useMemo(
    () => ({
      status,
      selfId,
      game,
      players,
      messages,
      setCursor,
      fill,
      sendChat,
      reset,
      join,
    }),
    [status, selfId, game, players, messages, setCursor, fill, sendChat, reset, join],
  )
}
