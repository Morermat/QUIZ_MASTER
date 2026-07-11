const jwt=require('jsonwebtoken');const game=require('../gameLogic');const {users,addPresence,removePresence}=require('../store');const {secret}=require('../config');
module.exports=io=>{io.use((socket,next)=>{try{const token=socket.handshake.auth?.token;if(!token)return next(new Error('AUTH_REQUIRED'));const d=jwt.verify(token,secret),u=users.get(d.userId);if(!u)return next(new Error('USER_NOT_FOUND'));socket.data.user=u;socket.data.tabId=socket.handshake.auth?.tabId||socket.id;next()}catch{return next(new Error('INVALID_TOKEN'))}});
io.on('connection',socket=>{const user=socket.data.user;addPresence(user.id,socket.id);
 const ackError=(ack,msg)=>{ack?.({ok:false,error:msg});if(!ack)socket.emit('app_error',msg)};
 socket.on('join_room',({roomCode}={},ack)=>{const code=String(roomCode||'');const r=game.addPlayer(code,user);if(r.error)return ackError(ack,r.error);if(socket.data.roomCode&&socket.data.roomCode!==code){socket.leave(socket.data.roomCode);game.removePlayer(socket.data.roomCode,user.id);game.emitState(io,socket.data.roomCode)}socket.data.roomCode=code;socket.join(code);game.emitState(io,code);ack?.({ok:true})});
 socket.on('leave_room',({roomCode}={},ack)=>{const code=String(roomCode||socket.data.roomCode||'');socket.leave(code);game.removePlayer(code,user.id);if(socket.data.roomCode===code)socket.data.roomCode=null;game.emitState(io,code);ack?.({ok:true})});
 socket.on('request_state', ({ roomCode } = {}, ack) => {
  const code = String(roomCode || '');
  if (socket.data.roomCode !== code) {
    return ack?.({ ok: false, error: 'Сначала войдите в комнату' });
  }
  const state = game.getGameState(code, user.id);
  if (!state) {
    return ack?.({ ok: false, error: 'Комната не найдена' });
  }
  socket.emit('game_state', state);
  ack?.({ ok: true, state });
});
socket.on('next_question', ({ roomCode } = {}, ack) => {
  const code = String(roomCode || '');
  const state = game.getGameState(code, user.id);
  if (!state?.isOrganizer) {
    return ack?.({ ok: false, error: 'Только организатор может переключать вопросы' });
  }
  game.advanceQuiz(code, io);
  ack?.({ ok: true });
});
socket.on('start_quiz',({roomCode}={},ack)=>{const code=String(roomCode||'');const s=game.getGameState(code,user.id);if(!s?.isOrganizer)return ackError(ack,'Только организатор может начать игру');const r=game.startQuiz(code,io);if(r.error)return ackError(ack,r.error);ack?.({ok:true})});
 socket.on('submit_answer',({roomCode,questionId,optionIds,optionId}={},ack)=>{const r=game.submitAnswer(String(roomCode||''),user.id,questionId,optionIds??optionId,io);if(r.error)return ackError(ack,r.error);socket.emit('answer_result',r);ack?.({ok:true,result:r})});
 socket.on('restart_quiz',({roomCode}={},ack)=>{const code=String(roomCode||'');const s=game.getGameState(code,user.id);if(!s?.isOrganizer)return ackError(ack,'Только организатор может перезапустить игру');const r=game.restartQuiz(code,io);if(r.error)return ackError(ack,r.error);ack?.({ok:true})});
 socket.on('set_organizer',({roomCode,targetUserId,enabled}={},ack)=>{const code=String(roomCode||'');const r=game.setOrganizer(code,user.id,String(targetUserId||''),!!enabled);if(r.error)return ackError(ack,r.error);game.emitState(io,code);ack?.({ok:true})});
 socket.on('disconnect',()=>{const remaining=removePresence(user.id,socket.id);if(!remaining&&socket.data.roomCode){game.removePlayer(socket.data.roomCode,user.id);game.emitState(io,socket.data.roomCode)}});
});};
