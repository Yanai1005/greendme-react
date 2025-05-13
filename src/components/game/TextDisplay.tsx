interface TextDisplayProps {
    text: string;
    input: string;
}

const TextDisplay = (props: TextDisplayProps) => {
    return (
        <div>
            {props.text.split('').map((char, index) => {
                let className = "";

                if (index < props.input.length) {
                    if (char === props.input[index]) {
                        className = "correct";
                    } else {
                        className = "incorrect";
                    }
                } else if (index === props.input.length) {
                    className = "current";
                }

                return (
                    <span key={index} className={className}>
                        {char}
                    </span>
                );
            })}
        </div>
    );
};

export default TextDisplay;
