import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export interface TeamDetailData {
    members: Person[];
    events: Event[];
}

export interface Person {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
}

export interface Event {
    id: number;
    name: string;
    statut: string;
}

interface TeamDetailsProps {
    teamId: number;
    teamName: string;
    data: TeamDetailData;
    onClose: () => void;
    onDelete: (teamId: number) => void;
}

export default function TeamDetails({ teamId, teamName, data, onClose, onDelete }: TeamDetailsProps) {
    const [activeTab, setActiveTab] = useState<'members' | 'events'>('members');
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await invoke("delete_team", { teamId });
            onDelete(teamId);
            onClose();
        } catch (error) {
            console.error("Erreur suppression:", error);
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white w-full max-w-md h-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">

            {/*OVERLAY DE CONFIRMATION*/}
            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-red-50 p-4 rounded-full mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">Supprimer l'équipe ?</h3>
                    <p className="text-sm text-gray-500 text-center mb-6">
                        Vous êtes sur le point de supprimer définitivement <b>{teamName}</b>. Cette action est irréversible.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium text-sm"
                            disabled={isDeleting}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm flex justify-center items-center gap-2"
                        >
                            {isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : "Confirmer"}
                        </button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">{teamName}</h2>
                    <p className="text-xs text-gray-500">Détails de l'équipe</p>
                </div>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>

            {/* ONGLETS */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
                <button onClick={() => setActiveTab('members')} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'members' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}>
                    👥 Membres ({data.members.length})
                </button>
                <button onClick={() => setActiveTab('events')} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'events' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}>
                    📅 Événements ({data.events.length})
                </button>
            </div>

            {/* CONTENU */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'members' && (
                    <div className="space-y-3">
                        {data.members.length === 0 ? <p className="text-gray-400 text-center text-sm py-10">Aucun membre.</p> :
                            data.members.map((member) => (
                                <div key={member.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs shadow-sm">{member.firstname[0]}{member.lastname[0]}</div>
                                    <div className="overflow-hidden"><p className="text-sm font-medium text-gray-800 truncate">{member.firstname} {member.lastname}</p><p className="text-xs text-gray-500 truncate">{member.email}</p></div>
                                </div>
                            ))
                        }
                    </div>
                )}
                {activeTab === 'events' && (
                    <div className="space-y-3">
                        {data.events.length === 0 ? <div className="text-center py-10"><p className="text-gray-400 text-sm">Aucun événement assigné.</p></div> :
                            data.events.map((event) => (
                                <div key={event.id} className="group p-3 border border-gray-100 rounded-lg hover:shadow-sm hover:border-blue-200 transition-all bg-white">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{event.name}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${event.statut === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{event.statut || 'Planifié'}</span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
                <button
                    onClick={() => setShowConfirm(true)}
                    className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                    title="Supprimer l'équipe"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
                <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 shadow-sm transition-all">
                    Fermer
                </button>
            </div>
        </div>
    );
}