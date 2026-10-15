import { createLobby, ApiError } from './lobby.js';
import { LOBBIES } from '../../shared/lobbies.js';

export function createPlazas(options) {
  const rooms = LOBBIES.map(info => ({ info, lobby: createLobby({ ...options, lobbyId: info.id }) }));
  const disabled = new Set();
  let loading;
  const ready = () => loading ||= Promise.all(rooms.map(async ({ info }) => {
    if (await options.services.redis(['GET', `pixelplaza:admin:closed:${info.id}`]) === '1') disabled.add(info.id);
  })).catch(error => { loading = null; throw error; });
  const roomFor = token => {
    const room = rooms.find(room => room.lobby.owns(token));
    if (!room) throw new ApiError(401, 'Your guest session ended. Please rejoin.');
    return room.lobby;
  };
  return {
    ready,
    list: () => rooms.map(({ info, lobby }) => ({ ...info, ...lobby.availability(), closed: disabled.has(info.id) })),
    async adminList() {
      await ready();
      return rooms.map(({ info, lobby }) => ({ ...info, ...lobby.availability(), closed: disabled.has(info.id), members: lobby.state().players.map(({ id, name, character }) => ({ id, name, character })) }));
    },
    async manage({ lobbyId, action, playerId }) {
      await ready();
      const room = rooms.find(room => room.info.id === lobbyId);
      if (!room) throw new ApiError(404, 'Lobby not found.');
      if (action === 'remove') return room.lobby.removePlayer(playerId);
      if (!['open', 'close'].includes(action)) throw new ApiError(400, 'Choose a valid action.');
      if (action === 'close') {
        await options.services.redis(['SET', `pixelplaza:admin:closed:${lobbyId}`, '1']);
        disabled.add(lobbyId);
      } else {
        await options.services.redis(['DEL', `pixelplaza:admin:closed:${lobbyId}`]);
        disabled.delete(lobbyId);
      }
      return { ok: true };
    },
    async join(body, ip) {
      await ready();
      const room = rooms.find(room => room.info.id === (body.lobbyId || 'garden'));
      if (!room) throw new ApiError(400, 'Choose an available lobby.');
      if (disabled.has(room.info.id)) throw new ApiError(409, 'This lobby is closed to new players.');
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
