import { createLobby, ApiError } from './lobby.js';
import { LOBBIES } from '../../shared/lobbies.js';

export function createPlazas(options) {
  const rooms = LOBBIES.map(info => ({ info, lobby: createLobby({ ...options, lobbyId: info.id }) }));
  const roomFor = token => {
    const room = rooms.find(room => room.lobby.owns(token));
    if (!room) throw new ApiError(401, 'Your guest session ended. Please rejoin.');
    return room.lobby;
  };
  return {
    list: () => rooms.map(({ info, lobby }) => ({ ...info, ...lobby.availability() })),
    async join(body, ip) {
      const room = rooms.find(room => room.info.id === (body.lobbyId || 'garden'));
      if (!room) throw new ApiError(400, 'Choose an available lobby.');
      return room.lobby.join(body, ip);
    },
    read: token => roomFor(token).read(token),
    heartbeat: token => roomFor(token).heartbeat(token),
    token: token => roomFor(token).token(token),
    move: (token, body) => roomFor(token).move(token, body),
    chat: (token, body) => roomFor(token).chat(token, body),
    leave: token => roomFor(token).leave(token),
    close: () => Promise.all(rooms.map(room => room.lobby.close())),
  };
}
