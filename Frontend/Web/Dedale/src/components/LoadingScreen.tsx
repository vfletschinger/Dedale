export default function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-br from-slate-50 via-indigo-50 to-purple-50">
            <div className="flex flex-col items-center">
                <div className="relative">
                    {/* Glow effect behind the logo */}
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>

                    <img
                        src="/dedale.png"
                        alt="Dedale Logo"
                        className="w-32 h-32 md:w-48 md:h-48 object-contain relative z-10 animate-fade-in-up"
                    />
                </div>

                {/* Loading spinner or text could go here if needed, but keeping it clean for now as per plan */}
                <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></div>
                </div>
            </div>
        </div>
    );
}
