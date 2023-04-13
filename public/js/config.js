function config() {
    return {
        'production': {
            'RTCPeerConfiguration': {
                iceServers: [
                    {
                        urls: 'stun:stun.l.google.com:19302'
                    },
                    {
                        urls: 'turn:turn.talk-g.co:3478?transport=tcp',
                        username: 'talkg',
                        credential: 'topg'
                    }
                ]
            }
        }
    }
}